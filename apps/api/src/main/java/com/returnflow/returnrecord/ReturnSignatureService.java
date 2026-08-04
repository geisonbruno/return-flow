package com.returnflow.returnrecord;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.returnrecord.dto.CreateReturnSignatureRequest;
import com.returnflow.returnrecord.dto.ReturnSignatureResponse;
import com.returnflow.returnrecord.dto.SignaturePointRequest;
import com.returnflow.storage.ReturnMediaStorage;
import com.returnflow.tenant.TenantContext;

/**
 * Orchestrates the one-signature-per-return workflow, mirroring
 * {@link ReturnPhotoService}'s conventions: tenant scoping always from
 * {@link TenantContext}, driver identity always from the authenticated
 * principal.
 */
@Service
class ReturnSignatureService {

	private static final int MAX_SIGNER_NAME_LENGTH = 100;
	private static final int MAX_STROKES = 100;
	private static final int MAX_TOTAL_POINTS = 5000;

	/**
	 * Small enough to allow a short but real signature, large enough to
	 * reject an effectively blank drawing — a single tap, or a "stroke" whose
	 * points are all coincident or nearly so — that could otherwise slip past
	 * the per-stroke point-count check. Expressed in the same normalized
	 * (0..1) space the client sends; against {@link SvgSignatureRenderer}'s
	 * 1000x300 viewBox this corresponds to roughly 50px of total drawn ink.
	 */
	private static final double MIN_TOTAL_PATH_LENGTH_NORMALIZED = 0.05;

	private static final String SVG_CONTENT_TYPE = "image/svg+xml";

	private final ReturnRecordRepository returnRecordRepository;
	private final ReturnSignatureRepository returnSignatureRepository;
	private final ReturnMediaStorage returnMediaStorage;
	private final SvgSignatureRenderer svgSignatureRenderer;

	ReturnSignatureService(ReturnRecordRepository returnRecordRepository, ReturnSignatureRepository returnSignatureRepository,
			ReturnMediaStorage returnMediaStorage, SvgSignatureRenderer svgSignatureRenderer) {
		this.returnRecordRepository = returnRecordRepository;
		this.returnSignatureRepository = returnSignatureRepository;
		this.returnMediaStorage = returnMediaStorage;
		this.svgSignatureRenderer = svgSignatureRenderer;
	}

	@Transactional
	ReturnSignatureResponse create(UUID returnId, CreateReturnSignatureRequest request, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		// Same row lock ReturnPhotoService uses before assigning a photo
		// position: held for this whole transaction, so a concurrent
		// signature submission for THIS SAME return can't also observe "no
		// signature yet" and insert a second one. Submissions to different
		// returns never block each other.
		ReturnRecord returnRecord = returnRecordRepository
				.findByIdAndTenantIdAndDriverIdForUpdate(returnId, tenantId, principal.userId())
				.orElseThrow(ReturnRecordNotFoundException::new);

		if (returnSignatureRepository.existsByReturnRecordId(returnRecord.getId())) {
			throw new SignatureAlreadyExistsException();
		}

		String signerName = validateSignerName(request.signerName());
		List<List<NormalizedSignaturePoint>> strokes = validateStrokes(request.strokes());

		byte[] svg = svgSignatureRenderer.render(strokes);
		String storageKey = generateStorageKey(tenantId, returnRecord.getId());
		returnMediaStorage.store(storageKey, svg);

		ReturnSignature signature = new ReturnSignature(returnRecord.getTenant(), returnRecord, signerName, storageKey,
				SVG_CONTENT_TYPE, svg.length);
		ReturnSignature saved = returnSignatureRepository.save(signature);
		return toResponse(returnRecord.getId(), saved);
	}

	@Transactional(readOnly = true)
	ReturnSignatureResponse get(UUID returnId, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = requireOwnedReturn(returnId, tenantId, principal);
		ReturnSignature signature = returnSignatureRepository.findByReturnRecordIdAndTenantId(returnRecord.getId(), tenantId)
				.orElseThrow(ReturnSignatureNotFoundException::new);
		return toResponse(returnRecord.getId(), signature);
	}

	@Transactional(readOnly = true)
	SignatureContent content(UUID returnId, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = requireOwnedReturn(returnId, tenantId, principal);
		ReturnSignature signature = returnSignatureRepository.findByReturnRecordIdAndTenantId(returnRecord.getId(), tenantId)
				.orElseThrow(ReturnSignatureNotFoundException::new);
		byte[] bytes = returnMediaStorage.read(signature.getStorageKey());
		return new SignatureContent(bytes, signature.getContentType());
	}

	private ReturnRecord requireOwnedReturn(UUID returnId, UUID tenantId, AuthenticatedPrincipal principal) {
		return returnRecordRepository.findByIdAndTenantIdAndDriverId(returnId, tenantId, principal.userId())
				.orElseThrow(ReturnRecordNotFoundException::new);
	}

	private static String validateSignerName(String rawSignerName) {
		if (rawSignerName == null) {
			throw new InvalidSignerNameException();
		}
		String trimmed = rawSignerName.trim();
		if (trimmed.isEmpty() || trimmed.length() > MAX_SIGNER_NAME_LENGTH) {
			throw new InvalidSignerNameException();
		}
		return trimmed;
	}

	private static List<List<NormalizedSignaturePoint>> validateStrokes(List<List<SignaturePointRequest>> rawStrokes) {
		if (rawStrokes == null || rawStrokes.isEmpty() || rawStrokes.size() > MAX_STROKES) {
			throw new InvalidSignatureStrokesException();
		}

		List<List<NormalizedSignaturePoint>> strokes = new ArrayList<>();
		int totalPoints = 0;
		double totalPathLength = 0;
		for (List<SignaturePointRequest> rawStroke : rawStrokes) {
			if (rawStroke == null || rawStroke.size() < 2) {
				throw new InvalidSignatureStrokesException();
			}
			List<NormalizedSignaturePoint> stroke = new ArrayList<>(rawStroke.size());
			for (SignaturePointRequest point : rawStroke) {
				stroke.add(validatePoint(point));
			}
			totalPoints += stroke.size();
			double strokeLength = pathLength(stroke);
			if (strokeLength <= 0.0) {
				// Every point in this stroke is coincident: not a stroke,
				// just a tap or a duplicated point.
				throw new InvalidSignatureStrokesException();
			}
			totalPathLength += strokeLength;
			strokes.add(stroke);
		}

		if (totalPoints > MAX_TOTAL_POINTS) {
			throw new InvalidSignatureStrokesException();
		}
		if (totalPathLength < MIN_TOTAL_PATH_LENGTH_NORMALIZED) {
			throw new InvalidSignatureStrokesException();
		}
		return strokes;
	}

	private static NormalizedSignaturePoint validatePoint(SignaturePointRequest point) {
		if (point == null || point.x() == null || point.y() == null) {
			throw new InvalidSignatureStrokesException();
		}
		double x = point.x();
		double y = point.y();
		if (!Double.isFinite(x) || !Double.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
			throw new InvalidSignatureStrokesException();
		}
		return new NormalizedSignaturePoint(x, y);
	}

	private static double pathLength(List<NormalizedSignaturePoint> points) {
		double length = 0;
		for (int i = 1; i < points.size(); i++) {
			double dx = points.get(i).x() - points.get(i - 1).x();
			double dy = points.get(i).y() - points.get(i - 1).y();
			length += Math.sqrt(dx * dx + dy * dy);
		}
		return length;
	}

	/** Matches the key shape already documented in apps/api/CLAUDE.md's "Files and signatures" section. */
	private static String generateStorageKey(UUID tenantId, UUID returnId) {
		return "tenants/%s/returns/%s/signatures/customer/%s.svg".formatted(tenantId, returnId, UUID.randomUUID());
	}

	/** Package-visible so {@link DriverReturnService} can reuse the exact same safe mapping when embedding the signature in {@code ReturnResponse}. */
	static ReturnSignatureResponse toResponse(UUID returnId, ReturnSignature signature) {
		String contentPath = "/api/v1/driver/returns/%s/signature/content".formatted(returnId);
		return new ReturnSignatureResponse(signature.getId(), signature.getSignerName(), signature.getContentType(),
				signature.getSizeBytes(), contentPath, signature.getSignedAt());
	}

	record SignatureContent(byte[] bytes, String contentType) {
	}
}
