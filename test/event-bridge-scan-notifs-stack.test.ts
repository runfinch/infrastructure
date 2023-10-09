import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { EventBridgeScanNotifsStack } from '../lib/event-bridge-scan-notifs-stack';

describe('EventBridgeScanNotifsStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const eventBridgeStack = new EventBridgeScanNotifsStack(app, 'EventBridgeScanNotifsStack', 'test');

    const template = Template.fromStack(eventBridgeStack);

    template.resourceCountIs('AWS::Lambda::Function', 1);
    template.hasResource('AWS::Lambda::Function', {
      Properties: {
        Environment:{
            Variables: {
                "SNS_ARN": Match.anyValue()
            }
        },
        Runtime: "python3.11",
      },
    });

    const lambda = template.findResources('AWS::Lambda::Function')
    const lambdaLogicalID = Object.keys(lambda)[0]

    template.resourceCountIs('AWS::SNS::Topic', 1);

    template.resourceCountIs('AWS::Events::Rule', 1);
    template.hasResource('AWS::Events::Rule', {
        Properties: {
            EventPattern: {
                source: ["aws.inspector2"]
            },
            State: "ENABLED",
            Targets: [
                {
                    "Arn":{
                        "Fn::GetAtt": [
                            lambdaLogicalID,
                            "Arn"
                        ]
                    }
                }
            ],
        }
    });
  });
})
