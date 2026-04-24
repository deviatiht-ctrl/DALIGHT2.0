// PWA Install Prompt Logic
class PWAInstallPrompt {
    constructor() {
        this.deferredPrompt = null;
        this.installButton = null;
        this.isIOS = this.detectIOS();
        this.isAndroid = this.detectAndroid();
        this.isStandalone = this.isInStandaloneMode();

        this.init();
    }

    init() {
        // Only show on mobile devices and when not already installed
        if (!this.isMobileDevice() || this.isStandalone) {
            return;
        }

        this.createInstallButton();
        this.setupEventListeners();
        this.showInstallPrompt();
    }

    detectIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    detectAndroid() {
        return /Android/.test(navigator.userAgent);
    }

    isMobileDevice() {
        return this.isIOS || this.isAndroid;
    }

    isInStandaloneMode() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    createInstallButton() {
        // Create the install button
        this.installButton = document.createElement('div');
        this.installButton.id = 'pwa-install-prompt';
        this.installButton.innerHTML = `
            <div class="pwa-install-content">
                <div class="pwa-install-icon">
                    ${this.isIOS ? '<i class="fab fa-apple"></i>' : '<i class="fab fa-android"></i>'}
                </div>
                <div class="pwa-install-text">
                    <div class="pwa-install-title">
                        ${this.isIOS ? 'Installer sur iPhone' : 'Installer sur Android'}
                    </div>
                    <div class="pwa-install-subtitle">
                        Ajouter à l'écran d'accueil pour un accès rapide
                    </div>
                </div>
                <button class="pwa-install-btn" id="installBtn">
                    <i class="fas fa-download"></i>
                    Installer
                </button>
                <button class="pwa-install-close" id="closeInstallBtn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #pwa-install-prompt {
                position: fixed;
                bottom: 20px;
                left: 20px;
                right: 20px;
                background: linear-gradient(135deg, #8B5CF6, #6366F1);
                border-radius: 16px;
                box-shadow: 0 20px 45px rgba(139, 92, 246, 0.35);
                z-index: 10000;
                transform: translateY(200px);
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
            }

            #pwa-install-prompt.show {
                transform: translateY(0);
                opacity: 1;
            }

            .pwa-install-content {
                display: flex;
                align-items: center;
                padding: 16px 20px;
                gap: 12px;
            }

            .pwa-install-icon {
                width: 48px;
                height: 48px;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                color: white;
                flex-shrink: 0;
            }

            .pwa-install-text {
                flex: 1;
                min-width: 0;
            }

            .pwa-install-title {
                font-weight: 600;
                font-size: 1rem;
                color: white;
                margin-bottom: 2px;
            }

            .pwa-install-subtitle {
                font-size: 0.85rem;
                color: rgba(255, 255, 255, 0.9);
                line-height: 1.3;
            }

            .pwa-install-btn {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 10px 16px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }

            .pwa-install-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }

            .pwa-install-close {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                padding: 8px;
                border-radius: 8px;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }

            .pwa-install-close:hover {
                background: rgba(255, 255, 255, 0.2);
                color: white;
            }

            @media (max-width: 480px) {
                .pwa-install-content {
                    padding: 14px 16px;
                    gap: 10px;
                }

                .pwa-install-icon {
                    width: 40px;
                    height: 40px;
                    font-size: 1.2rem;
                }

                .pwa-install-title {
                    font-size: 0.9rem;
                }

                .pwa-install-subtitle {
                    font-size: 0.8rem;
                }

                .pwa-install-btn {
                    padding: 8px 12px;
                    font-size: 0.85rem;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(this.installButton);
    }

    setupEventListeners() {
        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
        });

        // Handle install button click
        document.addEventListener('click', (e) => {
            if (e.target.id === 'installBtn' || e.target.closest('#installBtn')) {
                this.handleInstall();
            }

            if (e.target.id === 'closeInstallBtn' || e.target.closest('#closeInstallBtn')) {
                this.hideInstallPrompt();
            }
        });

        // Register service worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                        console.log('SW registered: ', registration);
                    })
                    .catch((registrationError) => {
                        console.log('SW registration failed: ', registrationError);
                    });
            });
        }
    }

    showInstallPrompt() {
        // Show after a short delay
        setTimeout(() => {
            if (this.installButton) {
                this.installButton.classList.add('show');
            }
        }, 2000);
    }

    hideInstallPrompt() {
        if (this.installButton) {
            this.installButton.classList.remove('show');
            setTimeout(() => {
                this.installButton.remove();
                this.installButton = null;
            }, 400);
        }
    }

    async handleInstall() {
        if (!this.deferredPrompt) {
            // Fallback for iOS or when prompt is not available
            if (this.isIOS) {
                this.showIOSInstructions();
            } else {
                this.showAndroidInstructions();
            }
            return;
        }

        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await this.deferredPrompt.userChoice;

        // Reset the deferred prompt
        this.deferredPrompt = null;

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
            this.hideInstallPrompt();
        } else {
            console.log('User dismissed the install prompt');
        }
    }

    showIOSInstructions() {
        // Show iOS-specific instructions
        const instructions = document.createElement('div');
        instructions.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: white; border-radius: 16px; padding: 24px; max-width: 320px; text-align: center;">
                    <i class="fas fa-share" style="font-size: 2rem; color: #007AFF; margin-bottom: 16px;"></i>
                    <h3 style="margin-bottom: 12px; color: #333;">Ajouter à l'écran d'accueil</h3>
                    <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                        1. Appuyez sur <i class="fas fa-share"></i><br>
                        2. Sélectionnez "Ajouter à l'écran d'accueil"<br>
                        3. Appuyez sur "Ajouter"
                    </p>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: #007AFF; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Compris</button>
                </div>
            </div>
        `;
        document.body.appendChild(instructions);
        this.hideInstallPrompt();
    }

    showAndroidInstructions() {
        // Show Android-specific instructions
        const instructions = document.createElement('div');
        instructions.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: white; border-radius: 16px; padding: 24px; max-width: 320px; text-align: center;">
                    <i class="fas fa-ellipsis-v" style="font-size: 2rem; color: #8B5CF6; margin-bottom: 16px;"></i>
                    <h3 style="margin-bottom: 12px; color: #333;">Ajouter à l'écran d'accueil</h3>
                    <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                        1. Appuyez sur ⋮ (menu)<br>
                        2. Sélectionnez "Ajouter à l'écran d'accueil"<br>
                        3. Appuyez sur "Ajouter"
                    </p>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: #8B5CF6; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Compris</button>
                </div>
            </div>
        `;
        document.body.appendChild(instructions);
        this.hideInstallPrompt();
    }
}

// Initialize PWA install prompt when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PWAInstallPrompt();
});
