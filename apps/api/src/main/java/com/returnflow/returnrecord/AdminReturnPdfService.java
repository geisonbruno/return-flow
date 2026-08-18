package com.returnflow.returnrecord;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.pdf.ReturnPdfDocument;
import com.returnflow.pdf.ReturnPdfGenerator;
import com.returnflow.returnrecord.dto.AdminSummaryResponse;
import com.returnflow.route.Route;
import com.returnflow.storage.ReturnMediaStorage;
import com.returnflow.tenant.TenantContext;
import com.returnflow.user.User;

/**
 * Builds the administrative PDF for a closed return: authorize, load the
 * authoritative record, hand trusted values to {@link ReturnPdfGenerator},
 * return bytes. Nothing is persisted — the PDF is generated on demand and
 * never written to PostgreSQL, {@link ReturnMediaStorage}, or anywhere else
 * (root {@code CLAUDE.md} §18).
 *
 * <p>The caller supplies only a return identifier. Tenant scope comes from
 * {@link TenantContext} exactly as in every other service here, so a return
 * belonging to another tenant is indistinguishable from a nonexistent one.
 * ADMIN role is enforced by {@code auth.security.SecurityConfig}'s
 * {@code /api/v1/admin/**} rule, so a DRIVER never reaches this code.
 *
 * <p>Only {@link ReturnStatus#CLOSED} may produce a PDF. Read-only in every
 * sense: requesting a PDF is not a lifecycle event and mutates nothing.
 */
@Service
class AdminReturnPdfService {

	private final ReturnRecordRepository returnRecordRepository;
	private final ReturnSignatureRepository returnSignatureRepository;
	private final ReturnMediaStorage returnMediaStorage;
	private final AdminReturnMapper adminReturnMapper;
	private final ReturnPdfGenerator returnPdfGenerator;

	AdminReturnPdfService(ReturnRecordRepository returnRecordRepository,
			ReturnSignatureRepository returnSignatureRepository, ReturnMediaStorage returnMediaStorage,
			AdminReturnMapper adminReturnMapper, ReturnPdfGenerator returnPdfGenerator) {
		this.returnRecordRepository = returnRecordRepository;
		this.returnSignatureRepository = returnSignatureRepository;
		this.returnMediaStorage = returnMediaStorage;
		this.adminReturnMapper = adminReturnMapper;
		this.returnPdfGenerator = returnPdfGenerator;
	}

	@Transactional(readOnly = true)
	ReturnPdf generate(UUID returnId) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = returnRecordRepository.findByIdAndTenantId(returnId, tenantId)
				.orElseThrow(ReturnRecordNotFoundException::new);
		if (returnRecord.getStatus() != ReturnStatus.CLOSED) {
			throw new InvalidReturnLifecycleException("Only a closed return can produce a PDF.");
		}

		ReturnSignature customerSignature = findSignature(returnRecord.getId(), tenantId, SignatureType.CUSTOMER);
		ReturnSignature warehouseSignature = findSignature(returnRecord.getId(), tenantId, SignatureType.WAREHOUSE);

		User driver = returnRecord.getDriver();
		Route route = returnRecord.getRoute();

		ReturnPdfDocument document = new ReturnPdfDocument(
				returnRecord.getReturnNumber(),
				returnRecord.getStatus().name(),
				returnRecord.getCustomerName(),
				returnRecord.getProductName(),
				returnRecord.getQuantity(),
				returnRecord.getUnit().name(),
				ReturnReasonLabels.labelFor(returnRecord.getReason()),
				returnRecord.getReasonDetails(),
				returnRecord.getObservation(),
				driver.getFullName(),
				route.getCode(),
				route.getName(),
				returnRecord.getCreatedAt(),
				returnRecord.getReviewStartedAt(),
				returnRecord.getClosedAt(),
				returnRecord.getSellable(),
				returnRecord.getCreditCustomer(),
				returnRecord.getChargeCustomer(),
				returnRecord.getChargeDriver(),
				returnRecord.getWarehouseObservation(),
				warehouseSignature == null ? null : warehouseSignature.getSignerName(),
				adminName(returnRecord.getReviewStartedBy(), tenantId),
				adminName(returnRecord.getClosedBy(), tenantId),
				customerSignature == null ? null : customerSignature.getSignerName(),
				customerSignature == null ? null : customerSignature.getSignedAt(),
				readSignature(customerSignature),
				readSignature(warehouseSignature));

		return new ReturnPdf(returnRecord.getReturnNumber(), returnPdfGenerator.generate(document));
	}

	private ReturnSignature findSignature(UUID returnRecordId, UUID tenantId, SignatureType signatureType) {
		return returnSignatureRepository.findByReturnRecordIdAndTenantIdAndSignatureType(returnRecordId, tenantId, signatureType)
				.orElse(null);
	}

	/**
	 * A closed return always has a warehouse signature, and normally a
	 * customer one; {@code null} is tolerated so a record missing either still
	 * produces a readable document instead of a failed download.
	 */
	private byte[] readSignature(ReturnSignature signature) {
		return signature == null ? null : returnMediaStorage.read(signature.getStorageKey());
	}

	/** Reuses the mapper's existing reviewer/closer name resolution rather than repeating the tenant-scoped user lookup here. */
	private String adminName(UUID adminId, UUID tenantId) {
		AdminSummaryResponse summary = adminReturnMapper.adminSummary(adminId, tenantId);
		return summary == null ? null : summary.fullName();
	}

	/** The generated bytes plus the return number the controller turns into a download filename. */
	record ReturnPdf(String returnNumber, byte[] bytes) {
	}
}
