package com.returnflow.returnrecord.dto;

/**
 * One raw client-submitted stroke point. Deliberately untyped/unvalidated
 * beyond nullability here — {@code returnrecord.ReturnSignatureService}
 * performs the real range/finiteness checks, since Bean Validation cannot
 * cleanly cascade through a {@code List<List<SignaturePointRequest>>}.
 */
public record SignaturePointRequest(Double x, Double y) {
}
