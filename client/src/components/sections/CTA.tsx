import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import Slider from "./slider";
export function CTA() {
  return (
    <>
      <section
        className="md:py-24 py-12 dark:bg-[#0F172A] relative overflow-hidden "
        id="pricing"
      >
    
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[130px] -translate-y-1/2 translate-x-1/3" />

        <div className=" mx-auto px-4 relative z-10 text-center">
          <h2 className="text-4xl md:text-6xl font-bold dark:text-white mb-8 tracking-tight">
            Ready to transform your <br /> business with AI?
          </h2>
          <p className="text-xl dark:text-white/70 mb-10 max-w-2xl mx-auto">
            Join thousands of solopreneurs and small teams who are scaling
            smarter with Requisor.
          </p>
          <div className="flex flex-wrap justify-center gap-7 relative">
            {/* <Button size="lg" className="h-14 px-10 rounded-full text-lg bg-accent hover:bg-accent/90 text-white font-semibold shadow-lg shadow-accent/25">
            Start your free trial
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-10 rounded-full text-lg border-white/20 text-white hover:bg-white/10 bg-transparent">
            View Pricing
          </Button> */}
            {/* card 1*/}
            <div
              data-variant="dramatic"
              className="relative rounded-3xl p-[2px]  before:absolute before:inset-0 before:rounded-3xl
                   before:blur-2xl before:opacity-100
                   "
            >
              <div
                className="relative rounded-3xl border border-white/60
                     "
              >
                <div
                  className="relative w-[19rem] aspect-[6/9] rounded-3xl
                       bg-neutral-900 text-white
                       filter-[url(#distort-dramatic)]"
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 via-transparent to-white/20 blur-xl mix-blend-overlay"></div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-white/10 blur-2xl mix-blend-overlay"></div>

                  <div className="relative z-10 flex h-full flex-col p-10">
                    <span className="w-fit rounded-xl bg-white/10 px-2 py-1 text-xs font-bold uppercase">
                      Free- Explorer
                    </span>

                    <h2 className="mt-2 text-3xl font-medium">$0 / month</h2>

                    <p className="mt-4 text-xs opacity-70">
                      For curious builders, students, and early-stage founders.
                    </p>

                    <ul className="mt-6 space-y-3 text-xs">
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">
                          1 active project
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">
                          AI Project Generator (idea →<br/>
                          milestones)
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">
                          Project Canvas (edit, reorder,<br/>
                          reprioritize)
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">
                          Basic AI task refinement
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">
                          Limited AI usage (daily cap)
                        </span>
                      </li>
                    </ul>
                    <button
                      className="mt-5 rounded-xl border border-white/30
                           bg-white/5 px-4 py-2 font-semibold
                           backdrop-blur hover:bg-white/10 transition"
                    >
                      Start for free
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/*card-2 */}{" "}
            <div
              data-variant="dramatic"
              className="relative rounded-3xl p-[2px] before:absolute before:inset-0 before:rounded-3xl
                   before:blur-2xl before:opacity-40 "
            >
              <div
                className="relative rounded-3xl border border-white/60
                     "
              >
                <div
                  className="relative w-[19rem] aspect-[7/12] rounded-3xl
                       bg-neutral-900 text-white
                       filter-[url(#distort-dramatic)]"
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 via-transparent to-white/20 blur-xl mix-blend-overlay"></div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-white/10 blur-2xl mix-blend-overlay"></div>

                  <div className="relative z-10 flex h-full flex-col p-10">
                    <span className="w-fit rounded-xl bg-white/10 px-2 py-1 text-xs font-bold uppercase">
                      Builder
                    </span>

                    <h2 className="mt-2 text-3xl font-medium">
                      $29 / month
                    </h2>

                    <p className="mt-4 text-xs opacity-70">
                      For solo founders, freelancers, and consultants.{" "}
                    </p>

                    <ul className="mt-6 space-y-3 text-xs">
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Unlimited projects</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Full AI Project Generator</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Project Canvas + Board view</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">AI task breakdown & prioritization</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">AI rewrite, clarify, and scope tasks</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Export to PDF / CSV</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Access for core agents</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Higher AI usage limits</span>
                      </li>
                    </ul>
                    <button
                      className="mt-5 rounded-xl border border-white/30
                           bg-white/5 px-4 py-2 font-semibold
                           backdrop-blur hover:bg-white/10 transition"
                    >
                      Buy Builder version
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/*card-3 */}{" "}
            <div
              data-variant="dramatic"
              className="relative rounded-3xl p-[2px]
              bg-[conic-gradient(from_180deg_at_50%_50%,#34ffd2,#22d3ee,#34ffd2)]
              shadow-[0_0_40px_rgba(52,255,210,0.6)]
              scale-[1.05] z-20"
            >
              <div
                className="relative rounded-3xl
                border-2 border-emerald-300
                shadow-[0_0_25px_rgba(52,255,210,0.45)]
                bg-neutral-900"
              >
                <div
                  className="relative w-[19rem] aspect-[8/16] rounded-3xl
                       bg-neutral-900 text-white
                       filter-[url(#distort-dramatic)]"
                >
                  <div
                    className="absolute inset-0 rounded-3xl
                  ring-1 ring-emerald-300/40
                  pointer-events-none"
                  />

                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 via-transparent to-white/20 blur-xl mix-blend-overlay"></div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-white/10 blur-2xl mix-blend-overlay"></div>

                  <div className="relative z-10 flex h-full flex-col p-10">
                    <span
                      className="w-fit rounded-xl
                    bg-black border border-emerald-400
                    px-2 py-1 text-xs font-bold uppercase
                    text-emerald-300
                    shadow-[0_0_15px_rgba(52,255,210,0.6)]"
                    >
                      Pro · Most Popular ⭐
                    </span>

                    <h2 className="mt-2 text-3xl font-medium">
                      $99 / month
                    </h2>

                    <p className="mt-4 text-xs opacity-70">
                      For agencies, startups, and small teams.
                    </p>

                    <ul className="mt-6 space-y-3 text-xs">
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Everything in Builder</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Full AI Agents Hub</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Multi-project roadmap view</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">
                          Advanced AI reasoning 
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Team collaboration (up to X users)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">
Integrations (Jira,Notion,Asana, <br/>Monday phased rollout)
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Export to Jira / PM tools</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">
                          Brand & tone memory (project-<br/>level instructions)
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Priority AI compute</span>
                      </li>
                    </ul>
                    <button
                      className="mt-5 rounded-xl border border-white/30
                           bg-white/5 px-4 py-2 font-semibold
                           backdrop-blur hover:bg-white/10 transition"
                    >
                      Buy Pro version
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/*card-5 */}{" "}
            <div
              data-variant="dramatic"
              className="relative rounded-3xl p-[2px]              before:absolute before:inset-0 before:rounded-3xl
                   before:blur-2xl before:opacity-40"
            >
              <div
                className="relative rounded-3xl border border-white/60
                     "
              >
                <div
                  className="relative w-[19rem] aspect-[7/13] rounded-3xl
                       bg-neutral-900 text-white
                       filter-[url(#distort-dramatic)]"
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 via-transparent to-white/20 blur-xl mix-blend-overlay"></div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-white/10 blur-2xl mix-blend-overlay"></div>

                  <div className="relative z-10 flex h-full flex-col p-10">
                    <span className="w-fit rounded-xl bg-white/10 px-2 py-1 text-xs font-bold uppercase">
                      Customise
                    </span>

                    <h2 className="mt-auto text-3xl font-medium">
                      Custom pricing
                    </h2>

                    <p className="mt-4 text-xs opacity-70">
                      For universities, enterprises, and regulated industries.
                    </p>

                    <ul className="mt-6 space-y-3 text-xs">
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Everything in Pro</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Custom AI agents & workflows</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Private model routing / data<br/> isolation</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Advanced integrations & APIs</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">SSO & role-based access</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">Dedicated onboarding & support</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">SLA + compliance (HIPAA / SOC2-ready roadmap)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1">✅</span>
                        <span className="leading-relaxed">White-labeled or co-branded options</span>
                      </li>
                    </ul>
                    <button
                      className="mt-5 rounded-xl border border-white/30
                           bg-white/5 px-4 py-2 font-semibold
                           backdrop-blur hover:bg-white/10 transition"
                    >
                      Contact for pricing
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="md:mt-19 mt-5 text-sm dark:text-white/40">
            No credit card required · Cancel anytime
          </p>
        </div>
      </section>
      <div className=" md:mt-0 mt-5 dark:bg-[#0F172A]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.16 }}
          className=" flex justify-center"
        >
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-center">
            Our Partner companies
          </p>
        </motion.div>
        <Slider />{" "}
      </div>
    </>
  );
}
