import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { SSMPatchingStack } from '../lib/ssm-patching-stack';

describe('SSMPatchingStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const ssmPatchingStack = new SSMPatchingStack(app, 'SSMPatchingStack');

    const template = Template.fromStack(ssmPatchingStack);

    template.hasResource('AWS::SSM::MaintenanceWindow', {
      Properties: {
        AllowUnassociatedTargets: false,
        Cutoff: 0,
        Duration: 2,
        Name: 'Patching-Window',
        Schedule: 'cron(0 8 ? * * *)'
      }
    });

    template.hasResource('AWS::SSM::MaintenanceWindowTarget', {
      Properties: {
        Name: 'All-Instances-Patch-Target',
        ResourceType: 'INSTANCE',
        Targets: [
          {
            Key: 'tag:PVRE-Reporting',
            Values: ['SSM']
          }
        ],
        WindowId: {
          Ref: 'MaintenanceWindow'
        }
      }
    });

    template.hasResource('AWS::SSM::MaintenanceWindowTask', {
      Properties: {
        MaxConcurrency: '1',
        MaxErrors: '100%',
        Name: 'Patch-Task',
        Priority: 1,
        Targets: [
          {
            Key: 'WindowTargetIds',
            Values: [
              {
                Ref: 'MaintenanceWindowTarget'
              }
            ]
          }
        ],
        TaskArn: 'AWS-RunPatchBaseline',
        TaskInvocationParameters: {
          MaintenanceWindowRunCommandParameters: {
            Parameters: {
              Operation: ['Install']
            },
            DocumentVersion: '$LATEST'
          }
        },
        TaskType: 'RUN_COMMAND',
        WindowId: {
          Ref: 'MaintenanceWindow'
        }
      }
    });

    expect(ssmPatchingStack.terminationProtection).toBeTruthy();
  });
});
