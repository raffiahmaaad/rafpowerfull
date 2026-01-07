import PostalMime from "postal-mime";

export default {
  async email(message, env, ctx) {
    try {
      const parser = new PostalMime();
      const rawEmail = await new Response(message.raw).arrayBuffer();
      const email = await parser.parse(rawEmail);

      // Target URL - your Vercel app webhook endpoint
      const TARGET_URL =
        env.TARGET_URL || "https://raf-tools.vercel.app/api/tempmail/webhook";

      const response = await fetch(TARGET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject: message.headers.get("subject") || "(No Subject)",
          text: email.text || "",
          html: email.html || "",
        }),
      });

      if (!response.ok) {
        console.error(
          `Failed to forward email: ${response.status} ${response.statusText}`
        );
        message.setReject("Failed to forward email");
      }
    } catch (e) {
      console.error("Worker Error:", e);
      message.setReject("Internal Worker Error");
    }
  },
};
