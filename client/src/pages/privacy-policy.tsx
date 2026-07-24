import StaticPageLayout from "@/components/StaticPageLayout";

export default function PrivacyPolicyPage() {
  return (
    <StaticPageLayout title="Privacy Policy">
      <div className="text-center mb-12">
        <span className="inline-block px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-sm font-medium mb-4">Legal</span>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500">Effective Date: 09-30-2025</p>
      </div>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <p>
          <strong>Requisor AI</strong> ("Requisor", "we", "our") provides an AI-powered platform that helps teams
          transform conversations, product feedback, and usage data into structured product decisions and execution plans.
        </p>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Data We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account data</strong> — name, email address</li>
            <li><strong>Zoom integration data</strong> — meeting transcripts, meeting metadata (title, time, participants)</li>
            <li><strong>User-provided data</strong> — documents, notes, and other content you upload</li>
            <li><strong>Usage data</strong> — log files, device identifiers, browser type, pages visited, IP address</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Data</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Analyze conversations and extract product insights</li>
            <li>Generate PRDs, tasks, and execution plans</li>
            <li>Improve the product experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Security</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>TLS 1.2+ encryption in transit</li>
            <li>AES-256 encryption at rest</li>
            <li>Workspace-level access control</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Sharing</h2>
          <p>
            We do not sell user data. Data is only processed by infrastructure providers
            necessary to operate the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Retention</h2>
          <p>
            Users can delete their data anytime. All data is removed upon account deletion.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. User Rights</h2>
          <p>
            Users can request access, correction, or deletion of their data by contacting:
          </p>
          <p className="mt-2">
            <a href="mailto:support@requisor.io" className="text-teal-600 hover:text-teal-700 font-medium">
              support@requisor.io
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Third-Party Integrations</h2>
          <p>
            Zoom data is accessed only with explicit user authorization and can be disconnected
            at any time from Settings → Integrations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Changes to This Policy</h2>
          <p>
            We may update this policy periodically. Changes will be posted with a new effective date.
            If changes are material, we will notify you through the platform or by email.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contact Us</h2>
          <p>
            For questions or to exercise your privacy rights, contact us at{" "}
            <a href="mailto:support@requisor.io" className="text-teal-600 hover:text-teal-700 font-medium">
              support@requisor.io
            </a>
          </p>
        </section>
      </div>
    </StaticPageLayout>
  );
}
