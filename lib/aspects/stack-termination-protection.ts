#!/usr/bin/env node

// Finch Infrastructure
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

import { Aspects, IAspect, Stack } from "aws-cdk-lib";
import { IConstruct } from "constructs";

/**
 * Enable termination protection in all stacks.
 */
export class EnableTerminationProtectionOnStacks implements IAspect {
    visit(construct: IConstruct): void {
        if (Stack.isStack(construct)) {
            (<any>construct).terminationProtection = true;
        }
    }
}

export function applyTerminationProtectionOnStacks(constructs: IConstruct[]) {
    constructs.forEach((construct) => {
        Aspects.of(construct).add(new EnableTerminationProtectionOnStacks());
    })
}
