package com.returnflow.pdf;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Renders a {@link ReturnPdfDocument} into A4 portrait PDF bytes, entirely in
 * memory — nothing is written to disk, object storage, or the database (root
 * {@code CLAUDE.md} §18: generated on demand, not permanently stored).
 *
 * <p>Deliberately a plain layout engine rather than a template/reporting
 * framework: the document is one fixed administrative record, and a template
 * abstraction would be indirection with exactly one caller. Only the standard
 * PDF fonts (Helvetica) are used, so no font file is embedded or licensed.
 *
 * <p>Every value is wrapped to the available width and every section checks
 * for remaining space before it draws, so a long customer/product name,
 * observation, or reason detail flows onto further pages instead of
 * overflowing the page boundary.
 */
@Component
public class ReturnPdfGenerator {

	private static final PDRectangle PAGE_SIZE = PDRectangle.A4;
	private static final float MARGIN = 50f;
	private static final float LABEL_WIDTH = 150f;
	private static final float LINE_HEIGHT = 13f;
	private static final float BODY_SIZE = 10f;
	private static final float HEADING_SIZE = 11.5f;
	private static final float TITLE_SIZE = 20f;
	private static final float FOOTER_SIZE = 8f;
	private static final float BOTTOM_LIMIT = MARGIN + 22f;

	/** 200 x 60 keeps the 1000 x 300 signature viewBox's exact aspect ratio, so a signature is never stretched. */
	private static final float SIGNATURE_WIDTH = 200f;
	private static final float SIGNATURE_HEIGHT = 60f;

	private static final PDFont BODY_FONT = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
	private static final PDFont BOLD_FONT = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

	/** Self-describing regardless of the configured zone — the abbreviation ({@code AEST}/{@code AEDT}) is rendered from the timestamp itself. */
	private static final DateTimeFormatter TIMESTAMP_FORMAT =
			DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a zzz", Locale.ENGLISH);

	private final ZoneId businessZone;

	ReturnPdfGenerator(@Value("${app.operations.business-timezone}") String businessTimezone) {
		try {
			this.businessZone = ZoneId.of(businessTimezone);
		} catch (DateTimeException e) {
			throw new IllegalStateException("Invalid app.operations.business-timezone: '" + businessTimezone + "'.", e);
		}
	}

	public byte[] generate(ReturnPdfDocument document) {
		try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			writeMetadata(pdf, document);
			Layout layout = new Layout(pdf, document.returnNumber());
			try {
				writeHeader(layout, document);
				writeReturnInformation(layout, document);
				writeDriverAndRoute(layout, document);
				writeLifecycle(layout, document);
				writeWarehouseReview(layout, document);
				writeCustomerSignature(layout, document);
				writeWarehouseSignature(layout, document);
			} finally {
				layout.close();
			}
			pdf.save(out);
			return out.toByteArray();
		} catch (IOException e) {
			throw new ReturnPdfGenerationException("Failed to generate the return PDF.", e);
		}
	}

	/**
	 * Fixed, non-identifying document properties only — nothing here changes
	 * the record's business meaning, and no actor name or account detail is
	 * placed in metadata where it would be easy to miss when reviewing what
	 * the file exposes.
	 */
	private static void writeMetadata(PDDocument pdf, ReturnPdfDocument document) {
		PDDocumentInformation information = pdf.getDocumentInformation();
		information.setTitle("ReturnFlow Return Record " + document.returnNumber());
		information.setSubject("Return Record");
		information.setAuthor("ReturnFlow");
		information.setCreator("ReturnFlow");
	}

	private void writeHeader(Layout layout, ReturnPdfDocument document) throws IOException {
		layout.text(BOLD_FONT, TITLE_SIZE, MARGIN, "ReturnFlow");
		layout.advance(TITLE_SIZE + 4f);
		layout.text(BODY_FONT, HEADING_SIZE, MARGIN, "Return Record");
		layout.advance(HEADING_SIZE + 6f);
		layout.horizontalRule();
		layout.advance(14f);
		layout.text(BOLD_FONT, 13f, MARGIN, sanitize(document.returnNumber()));
		layout.text(BODY_FONT, BODY_SIZE, MARGIN + LABEL_WIDTH, "Status: " + sanitize(document.status()));
		layout.advance(20f);
	}

	private void writeReturnInformation(Layout layout, ReturnPdfDocument document) throws IOException {
		layout.heading("Return information");
		layout.field("Return number", document.returnNumber());
		layout.field("Customer", document.customerName());
		layout.field("Product", document.productName());
		layout.field("Quantity", document.quantity() + " " + document.unit());
		layout.field("Reason", document.reason());
		layout.optionalField("Reason details", document.reasonDetails());
		layout.optionalField("Driver observation", document.driverObservation());
		layout.advance(8f);
	}

	private void writeDriverAndRoute(Layout layout, ReturnPdfDocument document) throws IOException {
		layout.heading("Driver and route");
		layout.field("Driver", document.driverName());
		// The route recorded on the return at creation time, never the driver's
		// current assignment — a later reassignment must not rewrite history.
		String route = document.routeName() == null || document.routeName().isBlank()
				? document.routeCode()
				: document.routeCode() + " - " + document.routeName();
		layout.field("Route", route);
		layout.advance(8f);
	}

	private void writeLifecycle(Layout layout, ReturnPdfDocument document) throws IOException {
		layout.heading("Lifecycle");
		layout.field("Created at", timestamp(document.createdAt()));
		if (document.reviewStartedAt() != null) {
			layout.field("Review started at", timestamp(document.reviewStartedAt()));
		}
		layout.field("Closed at", timestamp(document.closedAt()));
		layout.advance(8f);
	}

	private void writeWarehouseReview(Layout layout, ReturnPdfDocument document) throws IOException {
		layout.heading("Warehouse review");
		layout.field("Sellable", yesNo(document.sellable()));
		layout.field("Credit customer", yesNo(document.creditCustomer()));
		layout.field("Charge customer", yesNo(document.chargeCustomer()));
		layout.field("Charge driver", yesNo(document.chargeDriver()));
		layout.optionalField("Warehouse observation", document.warehouseObservation());
		layout.field("Warehouse representative", orDash(document.warehouseRepresentativeName()));
		layout.field("Reviewed by", orDash(document.reviewedByName()));
		layout.field("Closed by", orDash(document.closedByName()));
		layout.advance(8f);
	}

	private void writeCustomerSignature(Layout layout, ReturnPdfDocument document) throws IOException {
		layout.heading("Customer acknowledgement");
		layout.field("Customer representative", orDash(document.customerRepresentativeName()));
		if (document.customerSignedAt() != null) {
			layout.field("Signed at", timestamp(document.customerSignedAt()));
		}
		layout.signature("Customer signature", document.customerSignatureSvg());
		layout.advance(8f);
	}

	private void writeWarehouseSignature(Layout layout, ReturnPdfDocument document) throws IOException {
		layout.heading("Warehouse signature");
		layout.field("Warehouse representative", orDash(document.warehouseRepresentativeName()));
		layout.signature("Warehouse signature", document.warehouseSignatureSvg());
	}

	private String timestamp(Instant instant) {
		if (instant == null) {
			return "-";
		}
		return TIMESTAMP_FORMAT.format(instant.atZone(businessZone));
	}

	/**
	 * The four warehouse decisions are mandatory to close, so in practice
	 * these are never null — the fallback exists so a record predating that
	 * guarantee still renders rather than failing.
	 */
	private static String yesNo(Boolean value) {
		if (value == null) {
			return "Not recorded";
		}
		return value ? "Yes" : "No";
	}

	private static String orDash(String value) {
		return value == null || value.isBlank() ? "-" : value;
	}

	/**
	 * The standard PDF fonts use WinAnsi encoding, which cannot represent
	 * every character a free-text customer/product name may contain — an
	 * unrepresentable character makes PDFBox throw, which would turn one
	 * unusual name into a failed download. Common typographic characters are
	 * transliterated to their ASCII equivalent (so an apostrophe stays an
	 * apostrophe) and anything still outside the encoding degrades to '?'
	 * rather than aborting the document.
	 */
	private static String sanitize(String value) {
		if (value == null) {
			return "";
		}
		StringBuilder sanitized = new StringBuilder(value.length());
		for (int i = 0; i < value.length(); i++) {
			char character = value.charAt(i);
			switch (character) {
				case '\r' -> { /* dropped; '\n' alone drives line breaks */ }
				case '\n' -> sanitized.append('\n');
				case '\t' -> sanitized.append(' ');
				case '‘', '’', '‛' -> sanitized.append('\'');
				case '“', '”', '‟' -> sanitized.append('"');
				case '–', '—', '−' -> sanitized.append('-');
				case '…' -> sanitized.append("...");
				case ' ' -> sanitized.append(' ');
				default -> sanitized.append(isRenderable(character) ? character : '?');
			}
		}
		return sanitized.toString();
	}

	/** Printable ASCII plus the Latin-1 range WinAnsi shares with it — deliberately conservative. */
	private static boolean isRenderable(char character) {
		return (character >= 32 && character <= 126) || (character >= 161 && character <= 255);
	}

	private static List<String> wrap(String text, PDFont font, float size, float maxWidth) throws IOException {
		List<String> lines = new ArrayList<>();
		for (String paragraph : text.split("\n", -1)) {
			if (paragraph.isEmpty()) {
				lines.add("");
				continue;
			}
			wrapParagraph(paragraph, font, size, maxWidth, lines);
		}
		return lines;
	}

	private static void wrapParagraph(String paragraph, PDFont font, float size, float maxWidth, List<String> lines)
			throws IOException {
		StringBuilder line = new StringBuilder();
		for (String word : paragraph.split(" ")) {
			if (word.isEmpty()) {
				continue;
			}
			String candidate = line.isEmpty() ? word : line + " " + word;
			if (width(candidate, font, size) <= maxWidth) {
				line.setLength(0);
				line.append(candidate);
				continue;
			}
			if (!line.isEmpty()) {
				lines.add(line.toString());
				line.setLength(0);
			}
			// A single word wider than the column (a long product code, a URL)
			// is split by character — otherwise it would run off the page.
			if (width(word, font, size) <= maxWidth) {
				line.append(word);
			} else {
				splitLongWord(word, font, size, maxWidth, lines, line);
			}
		}
		if (!line.isEmpty()) {
			lines.add(line.toString());
		}
	}

	private static void splitLongWord(String word, PDFont font, float size, float maxWidth, List<String> lines,
			StringBuilder remainder) throws IOException {
		StringBuilder chunk = new StringBuilder();
		for (int i = 0; i < word.length(); i++) {
			char character = word.charAt(i);
			if (!chunk.isEmpty() && width(chunk.toString() + character, font, size) > maxWidth) {
				lines.add(chunk.toString());
				chunk.setLength(0);
			}
			chunk.append(character);
		}
		remainder.append(chunk);
	}

	private static float width(String text, PDFont font, float size) throws IOException {
		return font.getStringWidth(text) / 1000f * size;
	}

	/**
	 * A downward-flowing cursor over one or more pages. Every draw goes
	 * through here so the "is there room left?" check can never be forgotten
	 * at a call site.
	 */
	private final class Layout {

		private final PDDocument pdf;
		private final String returnNumber;
		private PDPageContentStream stream;
		private float y;
		private int pageNumber;

		private Layout(PDDocument pdf, String returnNumber) throws IOException {
			this.pdf = pdf;
			this.returnNumber = returnNumber;
			startPage();
		}

		private void startPage() throws IOException {
			PDPage page = new PDPage(PAGE_SIZE);
			pdf.addPage(page);
			stream = new PDPageContentStream(pdf, page);
			pageNumber++;
			y = PAGE_SIZE.getHeight() - MARGIN;
		}

		private void finishPage() throws IOException {
			stream.beginText();
			stream.setFont(BODY_FONT, FOOTER_SIZE);
			stream.newLineAtOffset(MARGIN, MARGIN - 12f);
			stream.showText(sanitize(returnNumber) + "  -  ReturnFlow  -  Page " + pageNumber);
			stream.endText();
			stream.close();
		}

		private void close() throws IOException {
			finishPage();
		}

		/** Moves down, starting a new page when the requested space would cross the bottom margin. */
		private void advance(float amount) throws IOException {
			y -= amount;
			ensureSpace(0f);
		}

		private void ensureSpace(float needed) throws IOException {
			if (y - needed < BOTTOM_LIMIT) {
				finishPage();
				startPage();
			}
		}

		private void text(PDFont font, float size, float x, String value) throws IOException {
			stream.beginText();
			stream.setFont(font, size);
			stream.newLineAtOffset(x, y);
			stream.showText(value);
			stream.endText();
		}

		private void horizontalRule() throws IOException {
			stream.setLineWidth(0.7f);
			stream.moveTo(MARGIN, y);
			stream.lineTo(PAGE_SIZE.getWidth() - MARGIN, y);
			stream.stroke();
		}

		private void heading(String title) throws IOException {
			// Keeps a heading from being stranded alone at the foot of a page.
			ensureSpace(LINE_HEIGHT * 3);
			text(BOLD_FONT, HEADING_SIZE, MARGIN, sanitize(title));
			advance(LINE_HEIGHT + 4f);
		}

		private void optionalField(String label, String value) throws IOException {
			if (value != null && !value.isBlank()) {
				field(label, value);
			}
		}

		private void field(String label, String value) throws IOException {
			float valueX = MARGIN + LABEL_WIDTH;
			float valueWidth = PAGE_SIZE.getWidth() - MARGIN - valueX;
			List<String> lines = wrap(sanitize(value), BODY_FONT, BODY_SIZE, valueWidth);

			boolean labelDrawn = false;
			for (String line : lines) {
				ensureSpace(LINE_HEIGHT);
				if (!labelDrawn) {
					text(BOLD_FONT, BODY_SIZE, MARGIN, sanitize(label));
					labelDrawn = true;
				}
				text(BODY_FONT, BODY_SIZE, valueX, line);
				advance(LINE_HEIGHT);
			}
			// A value that wrapped to nothing (an empty string) still needs its
			// label, so the record never silently omits a field.
			if (!labelDrawn) {
				ensureSpace(LINE_HEIGHT);
				text(BOLD_FONT, BODY_SIZE, MARGIN, sanitize(label));
				advance(LINE_HEIGHT);
			}
		}

		/**
		 * Redraws the trusted stored signature strokes with PDF line
		 * primitives. The strokes stay vector art, so the signature prints at
		 * the printer's own resolution rather than as a rasterized image.
		 */
		private void signature(String label, byte[] svg) throws IOException {
			List<List<SignatureSvgPaths.Point>> strokes = SignatureSvgPaths.parse(svg);
			if (strokes.isEmpty()) {
				field(label, "Not captured.");
				return;
			}
			ensureSpace(SIGNATURE_HEIGHT + LINE_HEIGHT);
			text(BOLD_FONT, BODY_SIZE, MARGIN, sanitize(label));

			float boxX = MARGIN + LABEL_WIDTH;
			float boxTop = y + BODY_SIZE - 2f;

			stream.setLineWidth(0.5f);
			stream.setStrokingColor(0.6f, 0.6f, 0.6f);
			stream.addRect(boxX, boxTop - SIGNATURE_HEIGHT, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
			stream.stroke();

			stream.setStrokingColor(0f, 0f, 0f);
			stream.setLineWidth(1.1f);
			stream.setLineCapStyle(1);
			stream.setLineJoinStyle(1);
			for (List<SignatureSvgPaths.Point> stroke : strokes) {
				SignatureSvgPaths.Point first = stroke.getFirst();
				// SVG measures y downward and PDF upward, hence the subtraction.
				stream.moveTo(boxX + (float) first.x() * SIGNATURE_WIDTH, boxTop - (float) first.y() * SIGNATURE_HEIGHT);
				for (SignatureSvgPaths.Point point : stroke.subList(1, stroke.size())) {
					stream.lineTo(boxX + (float) point.x() * SIGNATURE_WIDTH, boxTop - (float) point.y() * SIGNATURE_HEIGHT);
				}
				stream.stroke();
			}
			advance(SIGNATURE_HEIGHT + 6f);
		}
	}
}
