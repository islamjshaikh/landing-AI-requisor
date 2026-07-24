import StaticPageLayout from "@/components/StaticPageLayout";
import { Mail, Clock, HelpCircle, Zap, Database, User } from "lucide-react";

export default function SupportPage() {
  return (
    <StaticPageLayout title="Support">
      <div className="text-center mb-12">
        <span className="inline-block px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-sm font-medium mb-4">Help</span>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Support</h1>
        <p className="text-gray-500 mt-2">We're here to help you get the most out of Requisor AI.</p>
      </div>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Mail className="h-8 w-8 text-teal-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact Us</h2>
          <p className="mb-4">Reach out to our support team:</p>
          <a href="mailto:support@requisor.io" className="text-teal-600 hover:text-teal-700 font-semibold text-lg">
            support@requisor.io
          </a>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Response time: 24–48 hours</span>
          </div>
        </div>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">We help with</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 bg-white">
              <Zap className="h-5 w-5 text-teal-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Zoom Integration</h3>
                <p className="text-sm text-gray-500">Connecting and managing your Zoom meetings</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 bg-white">
              <Database className="h-5 w-5 text-teal-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Data Ingestion</h3>
                <p className="text-sm text-gray-500">Importing transcripts, documents, and usage data</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 bg-white">
              <HelpCircle className="h-5 w-5 text-teal-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Product Usage</h3>
                <p className="text-sm text-gray-500">Getting the most out of AI features</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 bg-white">
              <User className="h-5 w-5 text-teal-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Account Issues</h3>
                <p className="text-sm text-gray-500">Login, billing, and account management</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </StaticPageLayout>
  );
}
