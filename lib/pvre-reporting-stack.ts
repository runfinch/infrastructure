import * as cdk from "aws-cdk-lib";
import * as cfninc from 'aws-cdk-lib/cloudformation-include';
import { Construct } from 'constructs';

export class PVREReportingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new cfninc.CfnInclude(this, "PVREReportingTemplate", {
      templateFile: "lib/pvre-reporting-template.yml",
    });
  }
}