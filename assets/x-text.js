// Character counting and thread splitting that follow X's weighting rules
// (the open-source twitter-text v3 config): links count as 23, emoji as 2,
// and characters outside the Latin and common punctuation ranges count as 2.
(function () {
  const LIMIT = 280;
  const PREMIUM_LIMIT = 25000;
  const URL_WEIGHT = 23;

  // Code point ranges that count as 1; everything else counts as 2.
  const LIGHT = [[0x0000, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037]];
  const URL_RE = /\bhttps?:\/\/[^\s]+|\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|co|dev|app|ai|me|xyz|gg|so|ly|in|uk)(?:\/[^\s]*)?/gi;
  // Flags are a pair of regional indicator symbols; twitter-text counts them as one emoji.
  const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}{2}/u;
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  function charWeight(cp) {
    return LIGHT.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
  }

  function urls(text) {
    return text.match(URL_RE) ?? [];
  }

  function weightedLength(text) {
    let total = 0;
    const rest = text.normalize('NFC').replace(URL_RE, () => {
      total += URL_WEIGHT;
      return '';
    });
    for (const { segment } of graphemes.segment(rest)) {
      if (EMOJI.test(segment)) {
        total += 2;
        continue;
      }
      for (const ch of segment) total += charWeight(ch.codePointAt(0));
    }
    return total;
  }

  // Greedily pack pieces (joined by `sep`) into chunks of at most `max`.
  function pack(pieces, sep, max) {
    const chunks = [];
    let cur = '';
    for (const piece of pieces) {
      const next = cur ? cur + sep + piece : piece;
      if (weightedLength(next) <= max) {
        cur = next;
      } else {
        if (cur) chunks.push(cur);
        cur = piece;
      }
    }
    if (cur) chunks.push(cur);
    return chunks;
  }

  // Break one paragraph into chunks: by sentence, then word, then hard cut.
  function splitParagraph(text, max) {
    if (weightedLength(text) <= max) return [text];
    const out = [];
    const sentences = text.split(/(?<=[.!?…])\s+/);
    for (const chunk of pack(sentences, ' ', max)) {
      if (weightedLength(chunk) <= max) {
        out.push(chunk);
        continue;
      }
      for (const part of pack(chunk.split(/\s+/), ' ', max)) {
        if (weightedLength(part) <= max) {
          out.push(part);
          continue;
        }
        // A single word longer than a post: cut it by characters.
        let piece = '';
        for (const ch of part) {
          if (weightedLength(piece + ch) > max) {
            out.push(piece);
            piece = '';
          }
          piece += ch;
        }
        if (piece) out.push(piece);
      }
    }
    return out;
  }

  // Blank lines always start a new post. Numbering ("2/7") is added on its
  // own line, and the space it needs is reserved before splitting.
  function splitThread(text, limit = LIMIT, numbered = true) {
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (!paragraphs.length) return [];
    let reserve = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      const max = limit - reserve;
      const posts = paragraphs.flatMap((p) => splitParagraph(p, max));
      if (!numbered || posts.length === 1) return posts;
      const label = (i) => `\n\n${i + 1}/${posts.length}`;
      const needed = weightedLength(label(posts.length - 1));
      if (needed <= reserve) return posts.map((p, i) => p + label(i));
      reserve = needed;
    }
    return paragraphs;
  }

  window.XText = { LIMIT, PREMIUM_LIMIT, weightedLength, urls, splitThread };
})();
