package com.returnflow.returnrecord;

/** Thrown when a photo doesn't exist, doesn't belong to the given return, or belongs to another tenant. */
class ReturnPhotoNotFoundException extends RuntimeException {
}
