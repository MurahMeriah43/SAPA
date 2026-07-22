/**
 * ==========================================================
 * SAPA V2
 * Router Module
 * ==========================================================
 */

export const Router = {

    allToolPages() {
        return document.querySelectorAll('main[id^="page-"]');
    },

    showPage(pageId) {

        document.querySelectorAll("main").forEach(el => {
            el.classList.add("hidden");
        });

        const page = document.getElementById(pageId);

        if (page) {
            page.classList.remove("hidden");
        }

        window.scrollTo(0, 0);
    },

    openTool(tool) {

        const menu = document.getElementById("pageMenu");

        if (menu) {
            menu.classList.add("hidden");
        }

        this.allToolPages().forEach(p => {
            p.classList.add("hidden");
        });

        const page = document.getElementById("page-" + tool);

        if (page) {
            page.classList.remove("hidden");
        }

        window.scrollTo(0, 0);
    },

    backMenu() {

        this.allToolPages().forEach(p => {
            p.classList.add("hidden");
        });

        const menu = document.getElementById("pageMenu");

        if (menu) {
            menu.classList.remove("hidden");
        }

        window.scrollTo(0, 0);
    },

    initMenuNav() {

        document.querySelectorAll("[data-open]").forEach(btn => {

            btn.addEventListener("click", () => {

                this.openTool(btn.dataset.open);

            });

        });

        document.querySelectorAll("[data-back]").forEach(btn => {

            btn.addEventListener("click", () => {

                this.backMenu();

            });

        });

    }

};