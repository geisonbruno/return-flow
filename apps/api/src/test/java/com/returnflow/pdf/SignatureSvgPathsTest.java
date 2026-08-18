package com.returnflow.pdf;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The parser only ever sees SVG this application generated itself, so these
 * cases mirror {@code returnrecord.SvgSignatureRenderer}'s exact output shape
 * (a 1000 x 300 viewBox, {@code M}/{@code L} path data, two decimals,
 * {@code Locale.ROOT}) rather than exercising general SVG syntax.
 */
class SignatureSvgPathsTest {

	@Test
	void recoversNormalizedPointsFromOneStroke() {
		byte[] svg = svg("<path d=\"M 100.00 150.00 L 500.00 75.00\" fill=\"none\" stroke=\"black\"/>");

		List<List<SignatureSvgPaths.Point>> strokes = SignatureSvgPaths.parse(svg);

		assertThat(strokes).hasSize(1);
		assertThat(strokes.getFirst()).hasSize(2);
		// 100/1000 and 150/300 return to the 0..1 form originally captured.
		assertThat(strokes.getFirst().getFirst().x()).isEqualTo(0.10);
		assertThat(strokes.getFirst().getFirst().y()).isEqualTo(0.50);
		assertThat(strokes.getFirst().get(1).x()).isEqualTo(0.50);
		assertThat(strokes.getFirst().get(1).y()).isEqualTo(0.25);
	}

	@Test
	void recoversEveryStrokeSeparately() {
		byte[] svg = svg("<path d=\"M 0.00 0.00 L 100.00 100.00\"/><path d=\"M 200.00 200.00 L 300.00 250.00 L 400.00 100.00\"/>");

		List<List<SignatureSvgPaths.Point>> strokes = SignatureSvgPaths.parse(svg);

		assertThat(strokes).hasSize(2);
		assertThat(strokes.get(0)).hasSize(2);
		assertThat(strokes.get(1)).hasSize(3);
	}

	@Test
	void ignoresASinglePointPathBecauseItDrawsNothing() {
		byte[] svg = svg("<path d=\"M 100.00 150.00\"/>");

		assertThat(SignatureSvgPaths.parse(svg)).isEmpty();
	}

	@Test
	void clampsCoordinatesIntoTheReservedBox() {
		byte[] svg = svg("<path d=\"M -50.00 -20.00 L 5000.00 9000.00\"/>");

		List<SignatureSvgPaths.Point> stroke = SignatureSvgPaths.parse(svg).getFirst();

		assertThat(stroke.getFirst().x()).isEqualTo(0.0);
		assertThat(stroke.getFirst().y()).isEqualTo(0.0);
		assertThat(stroke.get(1).x()).isEqualTo(1.0);
		assertThat(stroke.get(1).y()).isEqualTo(1.0);
	}

	@Test
	void returnsNothingForAbsentOrEmptyContent() {
		assertThat(SignatureSvgPaths.parse(null)).isEmpty();
		assertThat(SignatureSvgPaths.parse(new byte[0])).isEmpty();
		assertThat(SignatureSvgPaths.parse(svg(""))).isEmpty();
	}

	private static byte[] svg(String paths) {
		String content = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
				+ "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1000 300\" width=\"1000\" height=\"300\">"
				+ "<rect x=\"0\" y=\"0\" width=\"100%\" height=\"100%\" fill=\"white\"/>"
				+ paths
				+ "</svg>";
		return content.getBytes(StandardCharsets.UTF_8);
	}
}
