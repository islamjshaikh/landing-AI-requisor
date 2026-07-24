import React from "react";

export function Type() {
  return (
    <div className="pb-4 w-2xl ">
      <div className="relative">
        <div className="relative flex flex-col border dark:border-white/10 border-black/5 rounded-xl dark:bg-black bg-gray-200">
    
          <div className="overflow-y-auto">
            <textarea
              rows={1}
              className="w-full px-4 py-3 resize-none bg-transparent border-none
                         focus:outline-none focus-visible:ring-0
                         dark:placeholder:text-white/50 leading-normal placeholder:text-black/50
                         min-h-[80px] dark:text-white text-black"
              placeholder="Ask Requisor to generate a project plan for a new SaaS product..."
            />
          </div>

        
          <div className="h-10 relative">
            <div className="absolute left-3 right-3 bottom-3 flex items-center justify-between">
          
              <div className="flex items-center gap-2">
        
                <input
                  type="file"
                  id="fileInput"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      console.log(file)
                    }
                  }}
                />

                <button
                  type="button"
                  aria-label="Attach file"
                  onClick={() => document.getElementById("fileInput")?.click()}
                  className="p-2 dark:text-white/50 dark:hover:text-white transition rounded-lg hover:text-black/80
                  text-black/60 border dark:border-white/10 border-black/20 dark:hover:border-white/20 hover:border-black/20"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>

              </div>

              
              <button
                type="button"
                aria-label="Send message"
                className="p-2 text-emerald-500 hover:text-emerald-600 transition"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m16 12-4-4-4 4" />
                  <path d="M12 16V8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Type;
