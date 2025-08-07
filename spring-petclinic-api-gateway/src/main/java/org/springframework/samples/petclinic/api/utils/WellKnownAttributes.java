// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.api.utils;

/**
 * @deprecated Use org.springframework.samples.petclinic.api.Util.WellKnownAttributes instead
 */
@Deprecated
public final class WellKnownAttributes {
    public static final String REMOTE_APPLICATION = "aws.remote.application";
    public static final String REMOTE_OPERATION = "aws.remote.operation";

    public static final String OWNER_ID = "owner.id";
    public static final String PET_ID = "pet.id";
    public static final String ORDER_ID = "order.id";
    
    // Code location attributes following OpenTelemetry semantic conventions
    // https://opentelemetry.io/docs/specs/semconv/registry/attributes/code/
    public static final String CODE_FILE_PATH = "code.file.path";
    public static final String CODE_LINE_NUMBER = "code.line.number";
    public static final String CODE_FUNCTION_NAME = "code.function.name";
}
