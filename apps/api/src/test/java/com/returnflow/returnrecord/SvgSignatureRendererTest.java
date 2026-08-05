package com.returnflow.returnrecord;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Pure unit tests — no Spring context needed to prove the generated SVG is safe and deterministic. */
class SvgSignatureRendererTest {

	private final SvgSignatureRenderer renderer = new SvgSignatureRenderer();

	@Test
	void outputIsAWellFormedSvgWithTheExpectedViewBox() {
		String svg = render(oneStroke());

		assertThat(svg).startsWith("<?xml");
		assertThat(svg).contains("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1000 300\"");
		assertThat(svg).contains("</svg>");
	}

	@Test
	void oneStrokePerInputStrokeIsEmitted() {
		String svg = render(twoStrokes());

		assertThat(countOccurrences(svg, "<path ")).isEqualTo(2);
	}

	@Test
	void noScriptElementIsEverPresent() {
		String svg = render(oneStroke());

		assertThat(svg.toLowerCase()).doesNotContain("<script");
		assertThat(svg.toLowerCase()).doesNotContain("onload");
		assertThat(svg.toLowerCase()).doesNotContain("onerror");
	}

	@Test
	void noExternalResourceOrLinkIsEverPresent() {
		String svg = render(oneStroke());

		// The fixed "http://www.w3.org/2000/svg" xmlns declaration is expected
		// and safe (it is not fetched or followed); everything else that could
		// reach out to a URL or embed external content must be absent.
		assertThat(svg.toLowerCase()).doesNotContain("<image");
		assertThat(svg.toLowerCase()).doesNotContain("xlink:href");
		assertThat(svg.toLowerCase()).doesNotContain("<a ");
		assertThat(svg.toLowerCase()).doesNotContain("<object");
		assertThat(svg.toLowerCase()).doesNotContain("<embed");
		assertThat(svg.toLowerCase()).doesNotContain("<iframe");
		assertThat(svg.toLowerCase()).doesNotContain("<use");
	}

	@Test
	void outputContainsOnlyServerWrittenMarkupNeverClientText() {
		// A stroke drawn near the edges still must never leak anything other
		// than numeric path coordinates - there is no code path through which
		// arbitrary client text could reach the output at all, proven here by
		// asserting the whole document matches a fixed, closed element set.
		String svg = render(oneStroke());

		assertThat(svg).matches("(?s)^<\\?xml[^>]*\\?><svg[^>]*><rect[^>]*/><path[^>]*/></svg>$");
	}

	@Test
	void renderingIsDeterministicForTheSamePoints() {
		List<List<NormalizedSignaturePoint>> strokes = oneStroke();

		String first = new String(renderer.render(strokes), StandardCharsets.UTF_8);
		String second = new String(renderer.render(strokes), StandardCharsets.UTF_8);

		assertThat(first).isEqualTo(second);
	}

	@Test
	void generatedSizeStaysSmallForAShortSignature() {
		byte[] svg = renderer.render(oneStroke());

		assertThat(svg.length).isLessThan(2000);
	}

	private String render(List<List<NormalizedSignaturePoint>> strokes) {
		return new String(renderer.render(strokes), StandardCharsets.UTF_8);
	}

	private static List<List<NormalizedSignaturePoint>> oneStroke() {
		return List.of(List.of(
				new NormalizedSignaturePoint(0.1, 0.5),
				new NormalizedSignaturePoint(0.2, 0.4),
				new NormalizedSignaturePoint(0.3, 0.6)));
	}

	private static List<List<NormalizedSignaturePoint>> twoStrokes() {
		return List.of(
				List.of(new NormalizedSignaturePoint(0.1, 0.5), new NormalizedSignaturePoint(0.2, 0.4)),
				List.of(new NormalizedSignaturePoint(0.6, 0.2), new NormalizedSignaturePoint(0.7, 0.3)));
	}

	private static int countOccurrences(String haystack, String needle) {
		int count = 0;
		int index = 0;
		while ((index = haystack.indexOf(needle, index)) != -1) {
			count++;
			index += needle.length();
		}
		return count;
	}
}
