import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { readFileSync } from 'fs';
import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';

// the AMI is regional, which means an AMI has diferrent ids in differrent regions
// when overriding the macOSVersion or amiSearchString props, please make sure that the
// search actually returns usable AMIs. An example of how to do this using the AWS CLI:
// aws ec2 --region us-east-1 describe-images --filters \
//   "Name=name,Values=amzn-ec2-macos-12.6*" "Name=virtualization-type,Values=hvm" \
//   "Name=root-device-type,Values=ebs" "Name=architecture,Values=arm64_mac" --no-cli-pager
interface MacRunnerStackProps extends cdk.StackProps {
  userDataScriptPath?: string;
  availabilityZone?: string;
  macOSVersion?: string;
  amiSearchString?: string;
  hostType?: string;
  architecture?: string;
}

export class MacRunnerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MacRunnerStackProps) {
    super(scope, id, props);

    const vpc = cdk.aws_ec2.Vpc.fromLookup(this, 'VPC',{isDefault: true});

    const securityGroup = new ec2.SecurityGroup(this, 'MacEC2SecurityGroup', {
      vpc,
      description: 'Allow SSH (TCP port 22) in',
      allowAllOutbound: true
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access');

    const role = new iam.Role(this, 'MacEC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    const macHost = new ec2.CfnHost(this, 'MacHost', {
      availabilityZone: props?.availabilityZone ?? 'us-west-2d',
      instanceType: props?.hostType || 'mac2.metal'
    });

    const macOSVersion = props?.macOSVersion ?? '12.6';
    const amiSearchString = props?.amiSearchString ?? `amzn-ec2-macos-${macOSVersion}*`;
    const macImage = new ec2.LookupMachineImage({
      name: amiSearchString,
      filters: {
        'virtualization-type': ['hvm'],
        'root-device-type': ['ebs'],
        architecture: [props?.architecture ?? 'arm64_mac'],
        'owner-alias': ['amazon']
      }
    });

    const macInstance = new ec2.Instance(this, 'MacInstance', {
      vpc,
      availabilityZone: props?.availabilityZone ?? 'us-west-2d',
      instanceType: new ec2.InstanceType(props?.hostType ?? 'mac2.metal'),
      machineImage: macImage,
      securityGroup: securityGroup,
      role: role,
      keyName: 'runner-key',
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: ec2.BlockDeviceVolume.ebs(100)
        }
      ]
    });

    //Add the tag for SSM PVRE reporting. This tag is used in the pvre-reporting-template.yml file. 
    // See Resources.InventoryCollection.Properties.Targets property in pvre-reporting-template.yml file.
    Tags.of(macInstance).add('PVRE-Reporting', 'SSM')

    const cfnInstance = macInstance.node.defaultChild as ec2.CfnInstance;
    cfnInstance.addPropertyOverride('Tenancy', 'host');
    cfnInstance.addPropertyOverride('Affinity', 'host');

    // Dedicated host creation - If cdk destroy is run before 24 hrs, host will not be released
    //                           Comment out & change either line depending on if creating a new dedicated host
    cfnInstance.addPropertyOverride('HostId', macHost.attrHostId);
    // cfnInstance.addPropertyOverride('HostId', 'h-123456789');

    if (props?.userDataScriptPath) {
      const setupRunnerScript = readFileSync(props.userDataScriptPath, 'utf8');
      macInstance.addUserData(setupRunnerScript);
    }

    new cdk.CfnOutput(this, 'IP Address', {
      value: macInstance.instancePublicIp
    });
    new cdk.CfnOutput(this, 'ssh command', {
      value: 'ssh -i runner-key.pem -o IdentitiesOnly=yes ec2-user@' + macInstance.instancePublicIp
    });
  }
}
