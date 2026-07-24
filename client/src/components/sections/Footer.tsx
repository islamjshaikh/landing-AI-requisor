import logo from "@assets/Group_185_1764797140461.png";
import { motion } from "framer-motion"
export function Footer() {
  return (
    
    <footer className="bg-background md:pt-24 pt-12 pb-12 border-t border-border relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-20">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
           
                <motion.img
                  src={logo}
                  alt="Requisor Logo"
                  className="md:h-12 h-9 w-auto"
                  whileHover={{ rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 10 }}
                />

               <  span
                    
                    className="font-semibold text-xl md:text-xl lg:text-3xl tracking-wide text-foreground inline-block"
                  >
                    Requisor AI
                  </span>

            </div>
            <p className="text-muted-foreground max-w-xs mb-8 leading-relaxed text-base">
              Making bad projects extinct. The smart project manager for the AI era.
            </p>
            <div className="flex gap-8 ml-10 absolute bottom-33">
              {/* Social Icons placeholders */}
              {/*  Twitter*/}
             < div className="relative cursor-pointer transition-all duration-200 group/tooltip font-sans">

                {/* Tooltip / Profile Section */}
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 p-[10px] opacity-0 pointer-events-none transition-all duration-300 rounded-[15px] 
                             group-hover/tooltip:-top-[150px] group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:pointer-events-auto z-50"
                  style={{
                    boxShadow: 'inset 5px 5px 5px rgba(0, 0, 0, 0.2), inset -5px -5px 15px rgba(255, 255, 255, 0.1), 5px 5px 15px rgba(0, 0, 0, 0.3), -5px -5px 15px rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="bg-[#e6e6e6]  rounded-[10px_15px] p-[10px] border border-[rgba(0,0,0,1)]  w-max">
                    <div className="flex gap-[10px]">
                      {/* <div className="w-[50px] h-[50px] text-[25px] font-bold border border-[#000000] rounded-[10px] flex items-center justify-center bg-white text-[#2a2b2f]">
                        Ui
                      </div> */}
                      <div className="flex flex-col gap-0 text-black">
                        <div className="text-[17px] font-bold text-[#000000]">Requisor</div>
                        <div className="text-sm text-[#000000]/90 ">@Requisor.io</div>
                      </div>
                    </div>
                    <div className="text-[#000] pt-[5px] text-sm text-[#000000]/90">
                      500+ Followers
                    </div>
                  </div>
                </div>

                {/* Button / Icon Section */}
                <a 
                  href="https://linkedin.com/" 
                  className="relative block text-white decoration-0 group/icon"
                >
                  {/* The 3D Layer Container */}
                  <div className="w-[55px] h-[55px] transition-transform duration-300 group-hover/icon:rotate-[-35deg] group-hover/icon:skew-x-[20deg]">

                    {/* Layer 1 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#000] rounded-[5px] transition-all duration-300 dark:border-[rgba(255,255,255,1)]
                                     group-hover/icon:opacity-20 group-hover/icon:shadow-[-1px_1px_3px_#000]
                      "></span>

                    {/* Layer 2 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#000] rounded-[5px] transition-all duration-300 dark:border-[rgba(255,255,255,1)]
                                     group-hover/icon:opacity-40 group-hover/icon:translate-x-[5px] group-hover/icon:-translate-y-[5px] group-hover/icon:shadow-[-1px_1px_3px_#000]"></span>

                    {/* Layer 3 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#000] rounded-[5px] transition-all duration-300 dark:border-[rgba(255,255,255,1)]
                                     group-hover/icon:opacity-60 group-hover/icon:translate-x-[10px] group-hover/icon:-translate-y-[10px] group-hover/icon:shadow-[-1px_1px_3px_#000]"></span>

                    {/* Layer 4 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#000] rounded-[5px] transition-all duration-300 dark:border-[rgba(255,255,255,1)]
                                     group-hover/icon:opacity-80 group-hover/icon:translate-x-[15px] group-hover/icon:-translate-y-[15px] group-hover/icon:shadow-[-1px_1px_3px_#000]"></span>

                    {/* Top Layer (Icon) */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#000] rounded-[5px] transition-all duration-300 dark:border-[rgba(255,255,255,1)]
                                     flex items-center justify-center bg-black fill-[#000]
                                     group-hover/icon:opacity-100 group-hover/icon:translate-x-[20px] group-hover/icon:-translate-y-[20px] group-hover/icon:shadow-[-1px_1px_3px_#000]">
                       <svg viewBox="0 0 448 512" height="1.5em" className="fill-[#fff]">
                         
                           <path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM365.7 442.7h27.4L121.2 73.8H93.9L365.7 442.7z" />
                         
                      </svg>
                    </span>
                  </div>

                  {/* Bottom Text Label */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-[-5px] opacity-0 font-medium dark:text-[#fff] text-[#000] whitespace-nowrap transition-all duration-300 ease-out
                                  group-hover/icon:bottom-[-35px] group-hover/icon:opacity-100">
                    𝕏
                  </div>
                </a>
              </div>

              {/*youtube */}
              <div className="relative cursor-pointer transition-all duration-200 group/tooltip font-sans">

                {/* Tooltip / Profile Section */}
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 p-[10px] opacity-0 pointer-events-none transition-all duration-300 rounded-[15px] 
                             group-hover/tooltip:-top-[150px] group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:pointer-events-auto z-50"
                  style={{
                    boxShadow: 'inset 5px 5px 5px rgba(0, 0, 0, 0.2), inset -5px -5px 15px rgba(255, 255, 255, 0.1), 5px 5px 15px rgba(0, 0, 0, 0.3), -5px -5px 15px rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="bg-[#2a2b2f] rounded-[10px_15px] p-[10px] border border-[rgba(121,15,15,1)] w-max">
                    <div className="flex gap-[10px]">
                      {/* <div className="w-[50px] h-[50px] text-[25px] font-bold border border-[#f41c1c] rounded-[10px] flex items-center justify-center bg-white text-[#ab0202]">
                        Ui
                      </div> */}
                      <div className="flex flex-col gap-0 text-white">
                        <div className="text-[17px] font-bold text-[#d40000]">Requisor</div>
                        <div className="text-sm">@Requisor.io</div>
                      </div>
                    </div>
                    <div className="text-[#ccc] pt-[5px] text-sm">
                      500K+ Suscribers 
                    </div>
                  </div>
                </div>

                {/* Button / Icon Section */}
                <a 
                  href="https://linkedin.com/" 
                  className="relative block text-white decoration-0 group/icon"
                >
                  {/* The 3D Layer Container */}
                  <div className="w-[55px] h-[55px] transition-transform duration-300 group-hover/icon:rotate-[-35deg] group-hover/icon:skew-x-[20deg]">

                    {/* Layer 1 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#ff0000] rounded-[5px] transition-all duration-300
                                     group-hover/icon:opacity-20 group-hover/icon:shadow-[-1px_1px_3px_#ff0000]"></span>

                    {/* Layer 2 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#ff0000] rounded-[5px] transition-all duration-300
                                     group-hover/icon:opacity-40 group-hover/icon:translate-x-[5px] group-hover/icon:-translate-y-[5px] group-hover/icon:shadow-[-1px_1px_3px_#ff0000]"></span>

                    {/* Layer 3 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#ff0000] rounded-[5px] transition-all duration-300
                                     group-hover/icon:opacity-60 group-hover/icon:translate-x-[10px] group-hover/icon:-translate-y-[10px] group-hover/icon:shadow-[-1px_1px_3px_#ff0000]"></span>

                    {/* Layer 4 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#ff0000] rounded-[5px] transition-all duration-300
                                     group-hover/icon:opacity-80 group-hover/icon:translate-x-[15px] group-hover/icon:-translate-y-[15px] group-hover/icon:shadow-[-1px_1px_3px_#ff0000]"></span>

                    {/* Top Layer (Icon) */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#ff0000] rounded-[5px] transition-all duration-300
                                     flex items-center justify-center bg-black fill-[#1da1f2]
                                     group-hover/icon:opacity-100 group-hover/icon:translate-x-[20px] group-hover/icon:-translate-y-[20px] group-hover/icon:shadow-[-1px_1px_3px_#ff0000]">
                       <svg viewBox="0 0 448 512" height="1.5em" className="fill-[#ff0000]">
                         <path 
                           d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z" 
                           transform="scale(0.8) translate(12, 12)" 
                         />
                      </svg>
                    </span>
                  </div>

                  {/* Bottom Text Label */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-[-5px] opacity-0 font-medium text-[#ff0000] whitespace-nowrap transition-all duration-300 ease-out
                                  group-hover/icon:bottom-[-35px] group-hover/icon:opacity-100">
                    Youtube  
                  </div>
                </a>
              </div>


              
              {/* linkedIn*/ }
             <div className="relative cursor-pointer transition-all duration-200 group/tooltip font-sans">
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 p-[10px] opacity-0 pointer-events-none transition-all duration-300 rounded-[15px] 
                             group-hover/tooltip:-top-[150px] group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:pointer-events-auto z-50"
                  style={{
                    boxShadow: 'inset 5px 5px 5px rgba(0, 0, 0, 0.2), inset -5px -5px 15px rgba(255, 255, 255, 0.1), 5px 5px 15px rgba(0, 0, 0, 0.3), -5px -5px 15px rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="bg-[#2a2b2f] rounded-[10px_15px] p-[10px] border border-[rgba(11,63,95,1)] w-max">
                    <div className="flex gap-[10px]">
                      <div className="w-[50px] h-[50px] text-[25px] font-bold border border-[#1da1f2] rounded-[10px] flex items-center justify-center bg-white text-[#2a2b2f]">
                        Ui
                      </div>
                      <div className="flex flex-col gap-0 text-white">
                        <div className="text-[17px] font-bold text-[#1da1f2]">Requisor</div>
                        <div className="text-sm">@Requisor.io</div>
                      </div>
                    </div>
                    <div className="text-[#ccc] pt-[5px] text-sm">
                      500+ Connections
                    </div>
                  </div>
                </div>
                <a 
                  href="https://linkedin.com/" 
                  className="relative block text-white decoration-0 group/icon"
                >
              <div className="w-[55px] h-[55px] transition-transform duration-300 group-hover/icon:rotate-[-35deg] group-hover/icon:skew-x-[20deg]">

                    {/* Layer 1 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#1da1f2] rounded-[5px] transition-all duration-300
                                     group-hover/icon:opacity-20 group-hover/icon:shadow-[-1px_1px_3px_#1da1f2]"></span>

                    {/* Layer 2 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#1da1f2] rounded-[5px] transition-all duration-300
                                     group-hover/icon:opacity-40 group-hover/icon:translate-x-[5px] group-hover/icon:-translate-y-[5px] group-hover/icon:shadow-[-1px_1px_3px_#1da1f2]"></span>

                    {/* Layer 3 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#1da1f2] rounded-[5px] transition-all duration-300
                                     group-hover/icon:opacity-60 group-hover/icon:translate-x-[10px] group-hover/icon:-translate-y-[10px] group-hover/icon:shadow-[-1px_1px_3px_#1da1f2]"></span>

                    {/* Layer 4 */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#1da1f2] rounded-[5px] transition-all duration-300
                                     group-hover/icon:opacity-80 group-hover/icon:translate-x-[15px] group-hover/icon:-translate-y-[15px] group-hover/icon:shadow-[-1px_1px_3px_#1da1f2]"></span>

                    {/* Top Layer (Icon) */}
                    <span className="absolute top-0 left-0 h-full w-full border border-[#1da1f2] rounded-[5px] transition-all duration-300
                                     flex items-center justify-center bg-black fill-[#1da1f2]
                                     group-hover/icon:opacity-100 group-hover/icon:translate-x-[20px] group-hover/icon:-translate-y-[20px] group-hover/icon:shadow-[-1px_1px_3px_#1da1f2]">
                       <svg viewBox="0 0 448 512" height="1.5em" className="fill-[#1da1f2]">
                        <path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"></path>
                      </svg>
                    </span>
                  </div>

                  {/* Bottom Text Label */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-[-5px] opacity-0 font-medium text-[#1da1f2] whitespace-nowrap transition-all duration-300 ease-out
                                  group-hover/icon:bottom-[-35px] group-hover/icon:opacity-100">
                    LinkedIn
                  </div>
                </a>
              </div>
              
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 text-foreground">Product</h4>
            <ul className="space-y-4 text-base text-muted-foreground">
              <li><a href="#" className="hover:text-accent transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Changelog</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Docs</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 text-foreground">Company</h4>
            <ul className="space-y-4 text-base text-muted-foreground">
              <li><a href="#" className="hover:text-accent transition-colors">About</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Contact</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 text-foreground">Legal</h4>
            <ul className="space-y-4 text-base text-muted-foreground">
              <li><a href="#" className="hover:text-accent transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Terms</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Security</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-border/50 text-center text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; {new Date().getFullYear()} Requisor AI. All rights reserved.</p>
          <p className="flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
             All systems operational
          </p>
        </div>
      </div>
    </footer>
  );
}
