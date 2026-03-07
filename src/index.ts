import {
    Plugin,
    showMessage,
    confirm,
    Dialog,
    Menu,
    openTab,
    adaptHotkey,
    getFrontend,
    getBackend,
    IModel,
    Protyle,
    openWindow,
    IOperation,
    Constants,
    openMobileFileById,
    lockScreen,
    ICard,
    ICardData
} from "siyuan";
import "@/index.scss";

import ImportForm from "@/ImportForm.svelte"

import { svelteDialog } from "./libs/dialog";

const NOTION_CARD_SELECTOR = '.protyle-wysiwyg .sb[style*="--notion-importer-block-color-"]';
const NOTION_CARD_REF_SELECTOR = `${NOTION_CARD_SELECTOR} [data-type="block-ref"][data-subtype="d"]`;

function decodeEmojiIcon(icon: string): string | null {
    if (!icon || icon.includes("/")) {
        return null;
    }

    try {
        return icon
            .split("-")
            .map((part) => String.fromCodePoint(parseInt(part, 16)))
            .join("");
    } catch {
        return null;
    }
}

function extractIconFromIAL(ial: string): string {
    const match = ial.match(/(?:^|\\s)icon="([^"]+)"/);
    return match?.[1] || "";
}

function shouldDecorateBlockRef(ref: HTMLElement): boolean {
    const parent = ref.parentNode;
    if (!parent) {
        return false;
    }

    for (const node of Array.from(parent.childNodes)) {
        if (node === ref) {
            break;
        }
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
            return false;
        }
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).innerText.trim()) {
            return false;
        }
    }

    return true;
}

async function fetchDocIcons(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) {
        return new Map();
    }

    const token = (window as any).siyuan?.config?.api?.token ?? "";
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers.Authorization = `Token ${token}`;
    }

    const quoted = ids.map((id) => `'${id}'`).join(",");
    const stmt = `SELECT id, ial FROM blocks WHERE type = 'd' AND id IN (${quoted})`;

    const postSQL = async (url: string) => {
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ stmt }),
        });
        if (!response.ok) {
            throw new Error(`SQL request failed: ${response.status}`);
        }
        const payload = await response.json();
        return payload?.data || [];
    };

    let rows: Array<{ id: string; ial: string }> = [];
    try {
        rows = await postSQL("/api/query/sql");
    } catch {
        rows = await postSQL("/api/sql");
    }

    return new Map(rows.map((row) => [row.id, extractIconFromIAL(row.ial || "")]));
}

function applyRefIcon(ref: HTMLElement, icon: string) {
    ref.dataset.notionImporterDecorated = "true";
    if (!icon) {
        return;
    }

    const emoji = decodeEmojiIcon(icon);
    if (emoji) {
        ref.dataset.notionImporterDocIconKind = "emoji";
        ref.dataset.notionImporterDocIconText = emoji;
        return;
    }

    ref.dataset.notionImporterDocIconKind = "image";
    ref.style.setProperty("--notion-importer-doc-icon-image", `url("/emojis/${icon}")`);
}

async function decorateNotionRefs() {
    const refs = Array.from(document.querySelectorAll(NOTION_CARD_REF_SELECTOR)) as HTMLElement[];
    const undecorated = refs.filter((ref) => !ref.dataset.notionImporterDecorated && shouldDecorateBlockRef(ref));
    if (!undecorated.length) {
        return;
    }

    const ids = Array.from(new Set(undecorated.map((ref) => ref.getAttribute("data-id") || "").filter(Boolean)));
    const iconMap = await fetchDocIcons(ids);

    for (const ref of undecorated) {
        const id = ref.getAttribute("data-id") || "";
        applyRefIcon(ref, iconMap.get(id) || "");
    }
}

function installNotionRuntimeDecorators() {
    let disposed = false;
    let scheduled = false;
    let observer: MutationObserver | null = null;
    let intervalID = 0;

    const schedule = () => {
        if (disposed || scheduled) {
            return;
        }
        scheduled = true;
        window.setTimeout(async () => {
            scheduled = false;
            if (disposed) {
                return;
            }
            try {
                await decorateNotionRefs();
            } catch (error) {
                console.warn("Failed to decorate Notion refs", error);
            }
        }, 120);
    };

    observer = new MutationObserver(() => schedule());
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-id", "data-type", "style"],
    });

    intervalID = window.setInterval(() => schedule(), 1500);
    schedule();

    return () => {
        disposed = true;
        observer?.disconnect();
        observer = null;
        if (intervalID) {
            window.clearInterval(intervalID);
        }
    };
}

export default class PluginSample extends Plugin {
    private cleanupNotionDecorators?: () => void;

    async onload() {
        // Custom icon for the toolbar button
        this.addIcons(`
<symbol id="iconCYImportLine" viewBox="0 0 36 36">
  <path d="M28 4H14.87L8 10.86V15h2v-1.39h7.61V6H28v24H8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-12 8h-6v-.32L15.7 6h.3Z" class="clr-i-outline clr-i-outline-path-1"/>
  <path d="M11.94 26.28a1 1 0 1 0 1.41 1.41L19 22l-5.68-5.68a1 1 0 0 0-1.41 1.41L15.2 21H3a1 1 0 1 0 0 2h12.23Z" class="clr-i-outline clr-i-outline-path-2"/>
  <path fill="none" d="M0 0h36v36H0z"/>
</symbol>
`);

        this.addTopBar({
            icon: "iconCYImportLine",
            title: this.i18n.addTopBarIcon,
            position: "right",
            callback: () => {
                this.showDialog()
            }
        });

        this.cleanupNotionDecorators = installNotionRuntimeDecorators();
        console.log(this.i18n.helloPlugin);
    }

    async onunload() {
        this.cleanupNotionDecorators?.();
        console.log(this.i18n.byePlugin);
    }

    async updateCards(options: ICardData) {
        options.cards.sort((a: ICard, b: ICard) => {
            if (a.blockID < b.blockID) {
                return -1;
            }
            if (a.blockID > b.blockID) {
                return 1;
            }
            return 0;
        });
        return options;
    }

    private showDialog() {
        // let dialog = new Dialog({
        //     title: `SiYuan ${Constants.SIYUAN_VERSION}`,
        //     content: `<div id="helloPanel" class="b3-dialog__content"></div>`,
        //     width: this.isMobile ? "92vw" : "720px",
        //     destroyCallback() {
        //         // hello.$destroy();
        //     },
        // });
        // new HelloExample({
        //     target: dialog.element.querySelector("#helloPanel"),
        //     props: {
        //         app: this.app,
        //     }
        // });
        svelteDialog({
            title: this.i18n.dialogTitle,
            width: "800px",
            constructor: (container: HTMLElement) => {
                return new ImportForm({
                    target: container,
                    props: {
                        pluginInstance: this,
                    }
                });
            }
        });
    }
}
