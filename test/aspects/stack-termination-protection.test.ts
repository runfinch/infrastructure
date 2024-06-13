// Finch Infrastructure
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

import { App, Stack } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { applyTerminationProtectionOnStacks } from "../../lib/aspects/stack-termination-protection";

describe('Stack termination protection aspect', () => {
    it('must enable termination protection when applied to a stack and synthesized', () => {
        const app = new App();
        const stack = new Stack(app, 'FooStack');
        // stack needs one resource
        new Bucket(stack, 'BarBucket');

        applyTerminationProtectionOnStacks([stack]);
        app.synth();

        expect(stack.terminationProtection).toBeTruthy();
    });
});
