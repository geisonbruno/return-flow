package com.returnflow.returnrecord;

/** Thrown when a return doesn't exist, isn't owned by the requesting driver, or belongs to another tenant. */
class ReturnRecordNotFoundException extends RuntimeException {
}
