package com.returnflow.pdf;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Recovers the stroke polylines from a signature SVG this application itself
 * generated, so PDFBox can redraw them with its own line primitives — PDFBox
 * has no SVG support, and adding an SVG rasterizer (Batik and its transitive
 * XML stack) purely to redraw a handful of polylines would be a large
 * dependency for a tiny need.
 *
 * <p>This is <em>not</em> a general SVG parser and must never be pointed at
 * untrusted markup. It is safe here precisely because the input is never
 * client-supplied: {@code returnrecord.SvgSignatureRenderer} writes every
 * byte of it from already-validated normalized stroke points, in one fixed
 * shape — {@code <path d="M x y L x y ..."/>} over a {@value #VIEW_WIDTH} x
 * {@value #VIEW_HEIGHT} viewBox. Only numeric coordinates are read; no
 * entity, external reference, script, or nested element is interpreted, so
 * none of the usual XML-parsing attack surface exists.
 *
 * <p>Coordinates are returned normalized back to 0..1 (the form the client
 * originally captured and the backend validated), leaving the PDF renderer
 * free to place them in any rectangle without knowing the SVG's viewBox.
 * Anything unparseable is skipped rather than throwing: a signature that
 * cannot be redrawn must not fail the whole document.
 */
final class SignatureSvgPaths {

	private static final int VIEW_WIDTH = 1000;
	private static final int VIEW_HEIGHT = 300;

	/** {@code \b} keeps this from matching a different attribute that merely ends in {@code d}, such as {@code id="}. */
	private static final Pattern PATH_DATA = Pattern.compile("\\bd=\"([^\"]*)\"");
	private static final Pattern COORDINATE_PAIR = Pattern.compile("[ML]\\s*(-?\\d+(?:\\.\\d+)?)\\s+(-?\\d+(?:\\.\\d+)?)");

	private SignatureSvgPaths() {
	}

	/** A single point of a stroke, normalized to 0..1 with {@code y} measured downward, exactly as captured. */
	record Point(double x, double y) {
	}

	/**
	 * Returns one list of points per {@code <path>} in the document — an empty
	 * list when {@code svg} is null, empty, or contains no readable path.
	 */
	static List<List<Point>> parse(byte[] svg) {
		if (svg == null || svg.length == 0) {
			return List.of();
		}
		String content = new String(svg, StandardCharsets.UTF_8);
		List<List<Point>> strokes = new ArrayList<>();
		Matcher pathMatcher = PATH_DATA.matcher(content);
		while (pathMatcher.find()) {
			List<Point> stroke = parseStroke(pathMatcher.group(1));
			// A one-point path draws nothing; dropping it keeps the renderer's
			// loop free of an empty-segment special case.
			if (stroke.size() >= 2) {
				strokes.add(stroke);
			}
		}
		return strokes;
	}

	private static List<Point> parseStroke(String pathData) {
		List<Point> points = new ArrayList<>();
		Matcher matcher = COORDINATE_PAIR.matcher(pathData);
		while (matcher.find()) {
			try {
				double x = Double.parseDouble(matcher.group(1)) / VIEW_WIDTH;
				double y = Double.parseDouble(matcher.group(2)) / VIEW_HEIGHT;
				points.add(new Point(clamp(x), clamp(y)));
			} catch (NumberFormatException e) {
				// Unreachable for our own output (the regex already matched a
				// plain decimal, written with Locale.ROOT); skipped rather
				// than thrown so one odd coordinate cannot fail the document.
				continue;
			}
		}
		return points;
	}

	/** Guarantees a stroke can never be drawn outside the box the renderer reserved for it. */
	private static double clamp(double value) {
		return Math.max(0.0, Math.min(1.0, value));
	}
}
