// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
package org.springframework.samples.petclinic.customers;

import com.amazonaws.util.EC2MetadataUtils;
import io.opentelemetry.api.trace.Span;

public class Util {
    public static final String REGION_FROM_EKS = System.getProperty("AWS_REGION") != null ? System.getProperty("AWS_REGION") 
        : System.getenv("AWS_REGION") != null ? System.getenv("AWS_REGION") 
        : "us-west-2";

    public static final String REGION_FROM_EC2 = EC2MetadataUtils.getEC2InstanceRegion() != null ? EC2MetadataUtils.getEC2InstanceRegion() : "us-west-2";

    /**
     * Adds code location attributes to the current span following OpenTelemetry semantic conventions.
     * Automatically determines the calling class and method from the stack trace.
     */
    public static void addCodeLocationAttributes() {
        Span currentSpan = Span.current();
        if (currentSpan != null) {
            // Get the current stack trace to find the calling location
            StackTraceElement[] stackTrace = Thread.currentThread().getStackTrace();
            
            // Find the caller (skip getStackTrace and addCodeLocationAttributes)
            // Index 2 is the method that called addCodeLocationAttributes()
            if (stackTrace.length > 2) {
                StackTraceElement caller = stackTrace[2];
                
                // Use OpenTelemetry semantic convention attribute names
                currentSpan.setAttribute(WellKnownAttributes.CODE_FILE_PATH, caller.getFileName());
                currentSpan.setAttribute(WellKnownAttributes.CODE_LINE_NUMBER, caller.getLineNumber());
                // code.function.name should be fully qualified (className.methodName)
                currentSpan.setAttribute(WellKnownAttributes.CODE_FUNCTION_NAME, 
                    caller.getClassName() + "." + caller.getMethodName());
            }
        }
    }

    public static class WellKnownAttributes {
        public static final String OWNER_ID = "owner.id";
        public static final String PET_ID = "pet.id";
        public static final String ORDER_ID = "order.id";
        
        // Code location attributes following OpenTelemetry semantic conventions
        // https://opentelemetry.io/docs/specs/semconv/registry/attributes/code/
        public static final String CODE_FILE_PATH = "code.file.path";
        public static final String CODE_LINE_NUMBER = "code.line.number";
        public static final String CODE_FUNCTION_NAME = "code.function.name";
        
        // Deprecated attributes (kept for backward compatibility if needed)
        @Deprecated
        public static final String CODE_FILENAME = "code.filename";
        @Deprecated
        public static final String CODE_LINENO = "code.lineno";
        @Deprecated
        public static final String CODE_NAMESPACE = "code.namespace";
        @Deprecated
        public static final String CODE_FUNCTION = "code.function";
    }
}
