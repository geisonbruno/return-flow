package com.returnflow.returnrecord;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Component;

/**
 * Converts already-validated normalized stroke points into sanitized SVG
 * bytes. Every element and attribute in the output is fixed, server-written
 * markup — the only client-derived data that ever reaches the output is
 * numeric coordinates, formatted through {@link String#format} with a fixed
 * two-decimal pattern and {@link Locale#ROOT} (so a comma-decimal locale on
 * the server can never corrupt the path syntax), never concatenated as raw
 * text. No client-provided XML, script, external resource, or link is ever
 * possible in the output. {@code signerName} is never embedded here — only
 * the stroke geometry is drawn.
 */
@Component
class SvgSignatureRenderer {

	private static final int VIEW_WIDTH = 1000;
	private static final int VIEW_HEIGHT = 300;

	byte[] render(List<List<NormalizedSignaturePoint>> strokes) {
		StringBuilder svg = new StringBuilder();
		svg.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
		svg.append("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ")
				.append(VIEW_WIDTH).append(' ').append(VIEW_HEIGHT)
				.append("\" width=\"").append(VIEW_WIDTH).append("\" height=\"").append(VIEW_HEIGHT).append("\">");
		svg.append("<rect x=\"0\" y=\"0\" width=\"100%\" height=\"100%\" fill=\"white\"/>");
		for (List<NormalizedSignaturePoint> stroke : strokes) {
			svg.append("<path d=\"").append(pathData(stroke))
					.append("\" fill=\"none\" stroke=\"black\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>");
		}
		svg.append("</svg>");
		return svg.toString().getBytes(StandardCharsets.UTF_8);
	}

	private static String pathData(List<NormalizedSignaturePoint> stroke) {
		StringBuilder data = new StringBuilder();
		for (int i = 0; i < stroke.size(); i++) {
			NormalizedSignaturePoint point = stroke.get(i);
			data.append(i == 0 ? 'M' : 'L')
					.append(format(point.x() * VIEW_WIDTH)).append(' ').append(format(point.y() * VIEW_HEIGHT)).append(' ');
		}
		return data.toString().trim();
	}

	private static String format(double value) {
		return String.format(Locale.ROOT, "%.2f", value);
	}
}
