package com.returnflow.returnrecord;

/** Thrown when a return already has a customer signature — at most one is ever allowed. */
class SignatureAlreadyExistsException extends RuntimeException {
}
