package com.returnflow.returnrecord;

/** Thrown when a return has no signature yet, or the signature isn't accessible to the requesting driver/tenant. */
class ReturnSignatureNotFoundException extends RuntimeException {
}
