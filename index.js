/* SillyTavern-SmartImport/index.js */

let utilsModule = null;
let isSmartImporting = false;

// INPUT NORMALIZER
function normalizeUrl(urlStr) {
    if (!urlStr) return '';
    // STRIP PROTOCOL, WWW, AND TRAILING SLASHES
    return urlStr.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
}

jQuery(async () => {
    // DYNAMIC BUTTON RENAMING
    $(document).on('click', '#external_import_button, .external_import_button', function() {
        // DELAY TO LET DOM RENDER
        setTimeout(() => {
            const $popup = $('.popup, #dialogue_popup, dialog').filter(':visible');
            const $importBtn = $popup.find('#dialogue_popup_ok, button, .menu_button').filter(function() {
                const text = $(this).text().trim().toLowerCase();
                return text === 'import';
            });
            if ($importBtn.length) $importBtn.text('Smart Import');
        }, 100);
    });

    // BUTTON INTERCEPTION OF ST NATIVE EVENT
    document.addEventListener('click', async function(e) {
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
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
        }

        // FIND VISIBLE POPUP
        const $popup = $targetBtn.closest('.popup, #dialogue_popup, dialog');
        if (!$popup.length || !$popup.is(':visible')) return;
        // FIND INPUT FIELD
        const $input = $popup.find('textarea, input[type="text"]').filter(':visible').first();
        if (!$input.length) return; 
        // VALIDATE INPUT CONTENT
        const inputVal = $input.val();
        if (!inputVal || inputVal.trim() === '') return;
        // NEWLINE SPLITTING
         const urls = inputVal.split(/\r?\n/).map(u => u.trim()).filter(u => u !== '');

        // LOCK SECURED
        isSmartImporting = true;
        // KILL NATIVE ST EVENT
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log("[Smart Import] Intercepted! Taking full ownership...");

        // ISOLATED EXECUTION BLOCK FOR SUCCESSFUL RELEASE
        try {
            // TACTILE UX BUTTON PAUSE
            $targetBtn.text("Processing...");
            $targetBtn.prop('disabled', true).css({ opacity: "0.5" });
            // BUFFER TO ABSORB MOBILE GHOST CLICKS
            await new Promise(resolve => setTimeout(resolve, 300));
            // CLEAR INPUT AND CANCEL POPUP
            $input.blur();
            $input.val(''); 
            const cancelBtn = $popup.find('#dialogue_popup_cancel, .cancel_button, .cancel')[0];
            if (cancelBtn) {
                cancelBtn.click();
            } else if (typeof $popup[0].close === 'function') {
                $popup[0].close();
            } else {
                $popup.hide();
            }

            // RALPH SACRIFICE TOASTR
            window.toastr.warning("(chuckles) I'm in danger.", "Ralph", { timeOut: 500 });
            // INITIAL PROCESSING TOASTR
            if (urls.length > 1) {
                window.toastr.info(`Processing ${urls.length} imports in the background...`, 'Smart Import');
            } else {
                window.toastr.info('Processing import...', 'Smart Import');
            }
            // READING BUFFER FOR PROCESSING
            await new Promise(resolve => setTimeout(resolve, 1000));

            // LOAD ST CONTEXT
            if (!utilsModule) utilsModule = await import('/scripts/utils.js');
            const { characters } = SillyTavern.getContext();
            // MAIN IMPORT LOOP
            for (let url of urls) {
                try {
                    // ASSASSINATE ALL ACCIDENTAL SPACES
                    url = url.replace(/\s+/g, '');
                    // STRIP TRACKING PARAMETERS FOR CHUB
                    if (url.toLowerCase().includes('chub.ai') && url.includes('?')) url = url.split('?')[0];
                    // DEFINE FINAL LOWERCASE URL FOR FIREWALLS
                    const lowerUrl = url.toLowerCase();

                    // UNSUPPORTED DUPLICATE
                    if (lowerUrl.includes('.png')) {
                        console.warn(`[Smart Import] Skipped PNG to prevent blind duplication: ${url}`);
                        window.toastr.warning(`PNGs cannot be duplicate-checked. Deactivate Smart Import to batch-import PNGs natively.`, 'Smart Import Blocked', { timeOut: 5000 });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        continue;
                    }

                    // BROKEN APIs FIREWALL
                    if (lowerUrl.includes('janitorai.com') || lowerUrl.includes('_character-') || lowerUrl.includes('realm.risuai.net')) {
                        console.warn(`[Smart Import] Skipped unsupported source: ${url}`);
                        const displayUrl = url.length > 30 ? url.substring(0, 30) + '...' : url;
                        window.toastr.warning(`SillyTavern native import fails. Skipped to prevent errors: ${displayUrl}`, 'Smart Import Blocked', { timeOut: 5000 });
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        continue;
                    }

                    // CHUB LOREBOOK SHORT-ID FIX
                    if (url.toLowerCase().startsWith('lorebooks/')) {
                        url = `https://chub.ai/${url}`;
                        console.log(`[Smart Import] Expanded short Lorebook ID to full URL: ${url}`);
                    }

                    const normTargetUrl = normalizeUrl(url);
                    // UNIVERSAL DUPLICATE DETECTION
                    const existingChar = characters.find(c => {
                        const exts = c.data?.extensions || {};

                        // GATHER IDENTIFICATION STRING
                        const identifiers = [
                            exts.source_url,
                            exts.source,
                            exts.chub?.full_path ? `chub.ai/characters/${exts.chub.full_path}` : '',
                            exts.chub?.id,
                            exts.pygmalion_id,
                            exts.pygmalion?.id,
                            exts.aicc,
                            exts.aicc?.id,
                            exts.perchance_data?.slug
                        ].map(id => {
                            // FILTER UNDEFINED/NON-STRING METADATA
                            if (!id || typeof id !== 'string') return '';
                            return normalizeUrl(id);
                        }).filter(id => id !== '');


                        // BIDIRECTIONAL MATCHING
                        let isMatch = identifiers.some(id => normTargetUrl.includes(id) || id.includes(normTargetUrl));

                        // AICC HEURISTIC
                        if (!isMatch && (normTargetUrl.includes('aicharactercards') || normTargetUrl.startsWith('aicc/'))) {
                            const cleanName = c.name ? c.name.replace(/[^a-z0-9]/gi, '').toLowerCase() : '';
                            const cleanUrl = normTargetUrl.replace(/[^a-z0-9]/gi, '');
                            const isAiccCard = JSON.stringify(c).toLowerCase().includes('aicharactercards');
                            if (cleanName.length > 3 && cleanUrl.includes(cleanName) && isAiccCard) {
                                isMatch = true;
                                console.log(`[Smart Import] AICC Match triggered for: ${c.name}`);
                            }
                        }
                        return isMatch;
                    });

                    // UPDATE EXISTING
                    if (existingChar) {
                        window.toastr.info(`Updating: ${existingChar.name}`, 'Smart Import');
                        await utilsModule.importFromExternalUrl(url, { preserveFileName: existingChar.avatar });
                        // ST NATIVE MESSAGE COOLDOWN
                        await new Promise(resolve => setTimeout(resolve, 1500));

                    // IMPORT NEW (OR LOREBOOK)
                    } else {
                        window.toastr.info(`Importing: ${url}`, 'Smart Import');

                        // LOREBOOK POPUP SLAYER
                        const popupSlayer = setInterval(() => {
                            // FIND LOREBOOK OVERWRITE POPUP
                            const $diag = $('.popup, #dialogue_popup, dialog').filter(':visible');
                            // IF FOUND WITH 'OVERWRITE'
                            if ($diag.length && $diag.text().toLowerCase().includes('overwrite')) {
                                // THEN FIND 'YES'-BUTTON
                                const $yesBtn = $diag.find('*').filter(function() {
                                    return $(this).text().trim().toLowerCase() === 'yes';
                                });
                                if ($yesBtn.length) {
                                    // AUTOMATIC LOREBOOK OVERWRITE
                                    if ($yesBtn[0]) $yesBtn[0].click();
                                    $yesBtn.trigger('click');
                                    console.log("[Smart Import] Assassinated Lorebook Popup!");
                                    clearInterval(popupSlayer);
                                }
                            }
                        }, 10);

                        try {
                            // EXECUTE ST NATIVE IMPORT
                            await utilsModule.importFromExternalUrl(url);
                        } finally {
                            // POPUP SLAYER SAFEGUARD
                            clearInterval(popupSlayer);
                        }
                        // ST NATIVE MESSAGE COOLDOWN
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }

                // SINGLE IMPORT FALLBACK
                } catch (err) {
                    console.error(`[Smart Import] Failed on: ${url}`, err);
                    window.toastr.error(`Import failed: ${url}`, 'Smart Import Error');
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }

            // IMPORT BATCH SUCCESS
            window.toastr.success('Smart Import completed!', 'Smart Import');

        // FATAL LOOP ERROR
        } catch (err) {
            console.error("[Smart Import] Fatal error:", err);
            window.toastr.error('An error occurred. Check console.', 'Smart Import');

        } finally {
            // RELEASE LOCK
            isSmartImporting = false;
            // RESTORE BUTTON STATE
            $targetBtn.text('Smart Import');
            $targetBtn.prop('disabled', false).css({ opacity: "1" });
        }
    }, true);
});