/* SillyTavern-SmartImport/index.js */

// MODULE CONSTANTS
const MODULE_NAME = 'st_smart_import_extension';
const FOLDER_NAME = 'third-party/SillyTavern-SmartImport';

// REGEX DEFINITIONS
const REGEX_PROTOCOL = /^https?:\/\//i;
const REGEX_WWW = /^www\./i;
const REGEX_TRAILING_SLASH = /\/$/;
const REGEX_NON_ALPHANUMERIC = /[^a-z0-9]/gi;

// INPUT NORMALIZER
const normalizeUrl = (urlStr) => {
    // STRIP PROTOCOL, WWW, AND TRAILING SLASHES
    return typeof urlStr === 'string'
        ? urlStr.replace(REGEX_PROTOCOL, '').replace(REGEX_WWW, '').replace(REGEX_TRAILING_SLASH, '').toLowerCase()
        : '';
};

// GLOBAL STATE
let isSmartImporting = false;

// DEFAULT SETTINGS
const defaultSettings = Object.freeze({
    enabled: true,
    autoTag: false, // NEW: Default OFF
    delayMs: 500
});

// LOAD PERSISTENT SETTINGS
function loadSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    extensionSettings[MODULE_NAME] = SillyTavern.libs.lodash.merge(
        structuredClone(defaultSettings),
        extensionSettings[MODULE_NAME]
    );
}

// RETRIEVE CURRENT SETTINGS
function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    return extensionSettings[MODULE_NAME];
}

// RENDER SETTINGS UI
async function renderSettings() {
    const { renderExtensionTemplateAsync, saveSettingsDebounced } = SillyTavern.getContext();
    const settings = getSettings();
    const settingsHtml = await renderExtensionTemplateAsync(
        FOLDER_NAME,
        'settings',
        settings
    );

    $('#extensions_settings2').append(settingsHtml);

    // TOGGLE ENABLE LISTENER
    $('#smart_import_enabled').on('change', function () {
        settings.enabled = !!$(this).prop('checked');
        saveSettingsDebounced();
        updateVisualState(settings.enabled);
    });

    // AUTO-TAG LISTENER
    $('#smart_import_auto_tag').on('change', function () {
        settings.autoTag = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    // RETROACTIVE TAGGING BUTTON
    $('#smart_import_retro_tag').on('click', async function () {
        const confirm = await SillyTavern.getContext().callGenericPopup(
            "This will scan your entire roster and add '@CreatorName' tags where missing based on metadata.<br><br><b>Note:</b> You will need to refresh the page (F5) afterward to see the new tags.<br><br>Continue?",
            { confirm: true, title: "Retroactive Creator Tagging" }
        );

        if (confirm) {
            runRetroactiveTagging();
        }
    });

    // DELAY INPUT LISTENER
    $('#smart_import_delay').on('input', function () {
        let val = parseInt($(this).val());
        if (isNaN(val)) val = 500;
        settings.delayMs = Math.min(Math.max(val, 0), 5000);
        saveSettingsDebounced();
    });

    // DELAY BLUR ENFORCER
    $('#smart_import_delay').on('blur', function () {
        let val = parseInt($(this).val());
        if (isNaN(val) || $(this).val().trim() === '') {
            val = 500;
        }

        val = Math.min(Math.max(val, 0), 5000);

        $(this).val(val);

        settings.delayMs = val;
        saveSettingsDebounced();
    });
}

// TAGGING LOGIC
function applyCreatorTag(character) {
    if (!character || !character.data || !character.avatar) return { tagCreated: false, charMapped: false };

    const exts = character.data.extensions || {};
    const creatorName = exts.chub?.full_path?.split('/')[0] || character.data.creator;

    if (!creatorName || typeof creatorName !== 'string') return { tagCreated: false, charMapped: false };

    const tagName = `@${creatorName.trim()}`;

    const context = SillyTavern.getContext();
    const stTags = context.tags || window.tags;
    const stTagMap = context.tagMap || context.tag_map || window.tagMap || window.tag_map;

    if (!stTags || !stTagMap) return { tagCreated: false, charMapped: false };

    let tagCreated = false;
    let charMapped = false;

    // 1. FIND/CREATE MASTER TAG
    let tagObj = stTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (!tagObj) {
        const newId = typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : Date.now().toString();

        tagObj = {
            id: newId,
            name: tagName,
            folder_type: "NONE",
            color: "default"
        };
        stTags.push(tagObj);
        tagCreated = true;
    }

    // 2. MAP TO BACKEND DATABASE
    if (!stTagMap[character.avatar]) {
        stTagMap[character.avatar] = [];
    }
    if (!stTagMap[character.avatar].includes(tagObj.id)) {
        stTagMap[character.avatar].push(tagObj.id);
        charMapped = true;
    }

    // 3. HEAL FRONTEND MEMORY
    if (!character.tags) character.tags = [];
    if (!character.tags.includes(tagObj.id) && !character.tags.includes(tagObj.name)) {
        character.tags.push(tagObj.id);
    }

    return { tagCreated, charMapped };
}

// RETROACTIVE LOOP
async function runRetroactiveTagging() {
    const { characters, loader, saveSettingsDebounced } = SillyTavern.getContext();
    const handle = loader.show({ message: "Tagging roster..." });
    
    let totalTagsCreated = 0;
    let totalCharsMapped = 0;

    try {
        for (const char of characters) {
            const result = applyCreatorTag(char);
            if (result.tagCreated) totalTagsCreated++;
            if (result.charMapped) totalCharsMapped++;
        }
        
        if (totalTagsCreated > 0 || totalCharsMapped > 0) {
            saveSettingsDebounced();
            
            toastr.success(
                `Created ${totalTagsCreated} new master tags and mapped ${totalCharsMapped} characters!`, 
                "Smart Import"
            );
        } else {
            toastr.info("No missing creator tags found.", "Smart Import");
        }
    } finally {
        handle.hide();
    }
}

// EXTENSION ACTIVATION HOOK
export async function onActivate() {
    loadSettings();

    await renderSettings();

    updateVisualState(getSettings().enabled);

    // DYNAMIC BUTTON RENAMING
    $(document).on('click.smartImportRename', '#external_import_button, .external_import_button', function() {
        if (!getSettings().enabled) return;

        // DELAY TO LET DOM RENDER
        setTimeout(() => {
            const $popup = $('.popup, #dialogue_popup, dialog').filter(':visible');
            const $importBtn = $popup.find('#dialogue_popup_ok, button, .menu_button').filter(function() {
                return $(this).text().trim().toLowerCase() === 'import';
            });
            if ($importBtn.length) $importBtn.text('Smart Import');
        }, 100);
    });

    document.addEventListener('click', handleSmartImportClick, true);
}

// EXTENSION DEACTIVATION HOOK
export function onDisable() {
    $(document).off('click.smartImportRename');
    document.removeEventListener('click', handleSmartImportClick, true);
    $('.smart-import-settings').remove();

    updateVisualState(false);
}

// TOGGLE CSS THEME STATE
function updateVisualState(isEnabled) {
    $('body').toggleClass('smart-import-active', isEnabled);
}

// LOAD CHARACTERS
function buildCharacterCache(characters) {
    return characters.map(c => {
        const exts = c.data?.extensions || {};
        const identifiers = [
            exts.source_url, exts.source,
            exts.chub?.full_path ? `chub.ai/characters/${exts.chub.full_path}` : '',
            exts.chub?.id, exts.pygmalion_id, exts.pygmalion?.id,
            exts.aicc, exts.aicc?.id, exts.perchance_data?.slug
        ].map(id => {
            if (!id || typeof id !== 'string') return '';
            return normalizeUrl(id);
        }).filter(id => id.length > 0);

        return {
            original: c,
            cleanName: c.name ? c.name.replace(REGEX_NON_ALPHANUMERIC, '').toLowerCase() : '',
            identifiers,
            isAiccCard: !!exts.aicc || JSON.stringify(c).toLowerCase().includes('aicharactercards') || JSON.stringify(c).toLowerCase().includes('"source":"aicc"')
        };
    });
}

// CORE LOGIC
async function handleSmartImportClick(e) {
    const settings = getSettings();
    if (!settings.enabled) return;

    // FIND TARGET BUTTON
    const $targetBtn = $(e.target).closest('button, .menu_button, #dialogue_popup_ok');
    if (!$targetBtn.length) return;
    // NORMALIZE BUTTON TEXT
    const currentText = $targetBtn.text().trim().toLowerCase();
    // IGNORE UNRELATED BUTTONS
    if (currentText !== 'smart import' && currentText !== 'processing...') return;

    // DOUBLE-LOCK GUARD
    if (isSmartImporting || currentText === 'processing...') {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
    }

    // FIND VISIBLE POPUP
    const $popup = $targetBtn.closest('.popup, #dialogue_popup, dialog');
    if (!$popup.length || !$popup.is(':visible')) return;
    // FIND INPUT FIELD
    const $input = $popup.find('textarea, input[type="text"]').filter(':visible').first();
    // VALIDATE INPUT CONTENT
    const inputVal = $input.val();

    if (typeof inputVal !== 'string' || inputVal.trim() === '') return;

    const { DOMPurify } = SillyTavern.libs;

    // SPLIT AND SANITIZE URLS
    const cleanInput = DOMPurify.sanitize(inputVal);
    const urls = cleanInput.split(/\r?\n/).map(u => u.trim()).filter(Boolean);

    // LOCK SECURED
    isSmartImporting = true;
    // KILL NATIVE ST EVENT
    e.preventDefault();
    e.stopImmediatePropagation();

    // API COMPATIBILITY CHECK
    const context = SillyTavern.getContext();
    if (!context.importFromExternalUrl) {
        toastr.error("SillyTavern API changed: importFromExternalUrl is missing.", "Smart Import Error");
        isSmartImporting = false;
        return;
    }

    const { characters, loader, importFromExternalUrl } = context;

    // STATE VARIABLES
    let loaderHandle = null;
    let isCancelled = false;
    let popupObserver = null;

    // ISOLATED EXECUTION BLOCK FOR SUCCESSFUL RELEASE
    try {
        // TACTILE UX BUTTON PAUSE
        $targetBtn.text("Processing...").prop('disabled', true).css({ opacity: "0.5" });
        // BUFFER TO ABSORB MOBILE GHOST CLICKS
        await new Promise(resolve => setTimeout(resolve, 150));
        // CLEAR INPUT AND CANCEL POPUP
        $input.blur().val('');

        const cancelBtn = $popup.find('#dialogue_popup_cancel, .cancel_button, .cancel')[0];
        if (cancelBtn) cancelBtn.click();
        else if (typeof $popup[0].close === 'function') $popup[0].close();
        else $popup.hide();

        // RALPH SACRIFICE TOASTR
        toastr.warning("(chuckles) I'm in danger.", "Ralph", { timeOut: 131 });
        // INITIAL PROCESSING TOASTR
        if (urls.length > 1) {
            toastr.info(`Processing ${urls.length} imports in the background...`, 'Smart Import');
        } else {
            toastr.info('Processing import...', 'Smart Import');
        }
        // READING BUFFER FOR PROCESSING
        await new Promise(resolve => setTimeout(resolve, 1000));
        toastr.clear();

        const charCache = buildCharacterCache(characters);

        // LOREBOOK POPUP SLAYER
        popupObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (!mutation.addedNodes.length) continue;

                const $newNodes = $(mutation.addedNodes);
                // FIND VISIBLE DIALOG
                const $diag = $newNodes.find('.popup, #dialogue_popup, dialog').addBack('.popup, #dialogue_popup, dialog').filter(':visible');

                // CONFIRM DIALOG CHECK
                const $okBtn = $diag.find('.popup-button-ok, #dialogue_popup_ok');

                if ($diag.length && $okBtn.length) {
                    // NATIVE CLICK TRIGGER
                    $okBtn[0].click();
                    return;
                }
            }
        });

        popupObserver.observe(document.body, { childList: true, subtree: true });

        const totalUrls = urls.length;

        // MAIN IMPORT LOOP
        for (let i = 0; i < totalUrls; i++) {
            // STOP BUTTON PRESS CHECK
            if (isCancelled) {
                console.log(`[${MODULE_NAME}] Import loop manually aborted by user.`);
                break;
            }

            // ASSASSINATE ALL ACCIDENTAL SPACES
            let url = urls[i].replace(/\s+/g, '');

            const step = `${i + 1}/${totalUrls}`;

            try {
                // DEFINE FINAL LOWERCASE URL
                let lowerUrl = url.toLowerCase();

                // UNSUPPORTED DUPLICATE CHECKER
                if (lowerUrl.includes('.png')) {
                    console.warn(`[${MODULE_NAME}] Skipped PNG to prevent blind duplication: ${url}`);
                    toastr.warning(`PNGs cannot be duplicate-checked. Deactivate Smart Import to batch-import PNGs natively.`, 'Smart Import Blocked', { timeOut: 5000 });
                    continue;
                }

                // BROKEN APIs FIREWALL
                if (lowerUrl.includes('janitorai.com') || lowerUrl.includes('_character-') || lowerUrl.includes('realm.risuai.net')) {
                    console.warn(`[${MODULE_NAME}] Skipped unsupported source: ${url}`);
                    const displayUrl = url.length > 30 ? url.substring(0, 30) + '...' : url;
                    toastr.warning(`Native import fails on this. Skipped to prevent errors: ${displayUrl}`, 'Smart Import Blocked', { timeOut: 5000 });
                    continue;
                }

                // STRIP TRACKING PARAMETERS FOR CHUB
                if (lowerUrl.includes('chub.ai') && url.includes('?')) {
                    url = url.split('?')[0];
                    lowerUrl = url.toLowerCase();
                }

                // CHUB LOREBOOK SHORT-ID FIX
                if (lowerUrl.startsWith('lorebooks/')) {
                    url = `https://chub.ai/${url}`;
                }

                // PERCHANCE UUID+.gz FIX
                if (lowerUrl.endsWith('.gz') && !lowerUrl.includes('/')) {
                    url = `https://perchance.org/ai-character-chat?data=${url}`;
                    console.log(`[${MODULE_NAME}] Expanded Perchance UUID to direct link: ${url}`);
                }

                const normTargetUrl = normalizeUrl(url);
                const cleanTargetUrl = normTargetUrl.replace(REGEX_NON_ALPHANUMERIC, '');

                // BIDIRECTIONAL MATCHING
                const existingCacheItem = charCache.find(c => {
                    let isMatch = c.identifiers.some(normId =>
                        normTargetUrl.includes(normId) || normId.includes(normTargetUrl)
                    );

                    // AICC HEURISTIC
                    if (!isMatch && (normTargetUrl.includes('aicharactercards') || normTargetUrl.startsWith('aicc/'))) {
                        if (c.cleanName.length > 2 && cleanTargetUrl.includes(c.cleanName) && c.isAiccCard) {
                            isMatch = true;
                        }
                    }

                    return isMatch;
                });

                const existingChar = existingCacheItem ? existingCacheItem.original : null;

                // CLEAR LOADER
                if (loaderHandle) {
                    loaderHandle.hide().catch(() => {});
                }
                const actionText = existingChar
                    ? `Updating: ${existingChar.name}`
                    : `Importing: ${url}`;
                // SPAWN DYNAMIC LOADER
                loaderHandle = loader.show({
                    blocking: false,
                    title: 'Smart Import',
                    message: `[${step}] ${actionText}`,
                    onStop: () => { isCancelled = true; }
                });

                // UPDATE EXISTING METADATA
                if (existingChar) {
                    await importFromExternalUrl(url, { preserveFileName: existingChar.avatar });
                // NEW IMPORT
                } else {
                    await importFromExternalUrl(url);
                }

                // AUTO-TAGGING INJECTION HOOK
                if (settings.autoTag) {
                    const freshChars = SillyTavern.getContext().characters;
                    const freshCache = buildCharacterCache(freshChars);
                    const targetChar = freshCache.find(c => c.identifiers.some(id => normTargetUrl.includes(id) || id.includes(normTargetUrl)))?.original;
                    
                    if (targetChar) {
                        const result = applyCreatorTag(targetChar);
                        if (result.tagCreated || result.charMapped) {
                            SillyTavern.getContext().saveSettingsDebounced();
                        }
                    }
                }

                // RATE LIMITING DELAY
                await new Promise(resolve => setTimeout(resolve, settings.delayMs));

            // SINGLE IMPORT ERROR FALLBACK
            } catch (err) {
                console.error(`[${MODULE_NAME}] Failed on: ${url}`, err);
                toastr.error(`[${step}] Import failed: ${url}`, 'Smart Import Error');
            }
        }

    // FATAL LOOP ERROR
    } catch (err) {
        console.error(`[${MODULE_NAME}] Fatal error:`, err);
        toastr.error('An error occurred. Check console.', 'Smart Import');
    } finally {
        // CLEANUP POPUP OBSERVER
        if (popupObserver) {
            popupObserver.disconnect();
        }
        // RELEASE LOCK
        isSmartImporting = false;
        // RESTORE BUTTON STATE
        $targetBtn.text('Smart Import').prop('disabled', false).css({ opacity: "1" });
        // CLEANUP LOADER
        if (loaderHandle) {
            loaderHandle.hide().catch(() => {});
        }

        // IMPORT BATCH FINISHED
        if (isCancelled) {
            toastr.warning('Smart Import cancelled.', 'Smart Import');
        } else {
            toastr.success('Smart Import completed!', 'Smart Import');
        }
    }
}