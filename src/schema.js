const { z } = require("zod");

const httpsUrl = z.string().startsWith("https://");

// The shape of one finished record
const BookSchema = z.object({
  title: z.string().min(1),
  product_url: httpsUrl,
  price_text: z.string().min(1),
  price_gbp: z.number().positive(),
  availability_text: z.string().min(1),
  rating_text: z.string().min(1),
  description: z.string().nullable(), // optional: null when the page has none
  source_page: httpsUrl,
  fetched_at: z.string().min(1),
});

module.exports = { BookSchema };
