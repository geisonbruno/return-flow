package com.returnflow.returnrecord;

import java.util.ArrayList;
import java.util.List;

import com.returnflow.returnrecord.dto.SignaturePointRequest;

/**
 * Signer-name and stroke validation shared by the customer signature
 * ({@link ReturnSignatureService}, Phase 5B) and the warehouse signature
 * ({@code AdminReturnReviewService}, Phase 7A) — extracted here rather than
 * duplicated, per root {@code CLAUDE.md} §13.1's instruction that the
 * customer-signature approach is "the model for any future signature
 * capture, including the eventual warehouse signature." Behavior is
 * unchanged from Phase 5B; only the location moved.
 */
final class SignatureStrokeValidator {

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

	private SignatureStrokeValidator() {
	}

	static String validateSignerName(String rawSignerName) {
		if (rawSignerName == null) {
			throw new InvalidSignerNameException();
		}
		String trimmed = rawSignerName.trim();
		if (trimmed.isEmpty() || trimmed.length() > MAX_SIGNER_NAME_LENGTH) {
			throw new InvalidSignerNameException();
		}
		return trimmed;
	}

	static List<List<NormalizedSignaturePoint>> validateStrokes(List<List<SignaturePointRequest>> rawStrokes) {
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
}
