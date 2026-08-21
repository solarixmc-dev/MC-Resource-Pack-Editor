import { useState } from "react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      // Create mailto link with form data
      const mailtoLink = `mailto:solarixmc@gmail.com?subject=${encodeURIComponent(`TextureLab Contact - ${formData.subject} (${formData.username})`)}&body=${encodeURIComponent(`Username: ${formData.username}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`)}`;
      
      // Open email client
      window.location.href = mailtoLink;
      
      setSubmitStatus("success");
      setFormData({ username: "", email: "", subject: "", message: "" });
    } catch (error) {
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-black dark:text-dark-text mb-4">Contact Us</h1>
            <p className="text-gray-600 dark:text-dark-text-secondary text-lg">
              Have questions or feedback about TextureLab? We'd love to hear from you!
            </p>
          </div>

          <div className="bg-white dark:bg-dark-secondary rounded-2xl border border-gray-200 dark:border-dark-border p-8 shadow-lg">
            {submitStatus === "success" && (
              <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
                <p className="text-green-800 dark:text-green-300 font-medium">
                  Message prepared! Your email client should open shortly.
                </p>
              </div>
            )}

            {submitStatus === "error" && (
              <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-red-800 dark:text-red-300 font-medium">
                  Something went wrong. Please try again.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  id="username"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-tertiary text-black dark:text-dark-text focus:ring-2 focus:ring-[#C2B280] focus:border-transparent outline-none transition-all"
                  placeholder="Your username"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-tertiary text-black dark:text-dark-text focus:ring-2 focus:ring-[#C2B280] focus:border-transparent outline-none transition-all"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-tertiary text-black dark:text-dark-text focus:ring-2 focus:ring-[#C2B280] focus:border-transparent outline-none transition-all"
                  placeholder="What's this about?"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  required
                  rows={6}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-tertiary text-black dark:text-dark-text focus:ring-2 focus:ring-[#C2B280] focus:border-transparent outline-none transition-all resize-none"
                  placeholder="Tell us what's on your mind..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-800 dark:hover:bg-gray-200 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSubmitting ? "Preparing..." : "Send Message"}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-dark-border text-center">
              <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                Or email us directly at{" "}
                <a href="mailto:solarixmc@gmail.com" className="text-[#C2B280] hover:underline">
                  solarixmc@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
    </div>
  );
}