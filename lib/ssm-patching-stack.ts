import * as cdk from 'aws-cdk-lib';
import { CfnMaintenanceWindow, CfnMaintenanceWindowTarget, CfnMaintenanceWindowTask } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { applyTerminationProtectionOnStacks } from './aspects/stack-termination-protection';

export class SSMPatchingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    applyTerminationProtectionOnStacks([this]);

    const maintenanceWindow = new CfnMaintenanceWindow(this, 'MaintenanceWindow', {
      name: `Patching-Window`,
      allowUnassociatedTargets: false,
      cutoff: 0,
      duration: 2,
      // Every day at 8 AM UTC
      schedule: 'cron(0 8 ? * * *)'
    });

    const maintenanceTarget = new CfnMaintenanceWindowTarget(this, 'MaintenanceWindowTarget', {
      name: 'All-Instances-Patch-Target',
      windowId: maintenanceWindow.ref,
      resourceType: 'INSTANCE',
      targets: [
        {
          key: 'tag:PVRE-Reporting',
          values: ['SSM']
        }
      ]
    });

    new CfnMaintenanceWindowTask(this, 'MaintenanceWindowTask', {
      taskArn: 'AWS-RunPatchBaseline',
      priority: 1,
      taskType: 'RUN_COMMAND',
      windowId: maintenanceWindow.ref,
      name: 'Patch-Task',
      targets: [
        {
          key: 'WindowTargetIds',
          values: [maintenanceTarget.ref]
        }
      ],
      taskInvocationParameters: {
        maintenanceWindowRunCommandParameters: {
          parameters: {
            Operation: ['Install']
          },
          documentVersion: '$LATEST'
        }
      },
      maxErrors: '100%',
      maxConcurrency: '1'
    });
  }
}
