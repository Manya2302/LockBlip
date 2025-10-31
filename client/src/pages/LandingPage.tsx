import { Button } from "@/components/ui/button";
import { Shield, Lock, Users, MessageSquare, Smartphone, Globe } from "lucide-react";
import { useLocation } from "wouter";
import lockblipLogo from "@assets/Untitled design_1761899121550.png";
import heroImage from '@assets/stock_images/happy_friends_messag_b27a8923.jpg';
import secureImage from '@assets/stock_images/person_using_smartph_2cd70d09.jpg';
import groupImage from '@assets/stock_images/group_of_people_vide_d23795e5.jpg';
import encryptedImage from '@assets/stock_images/smartphone_showing_e_411752b7.jpg';

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src={lockblipLogo} alt="LockBlip" className="h-10 w-10 object-contain rounded-lg shadow-md" />
              <span className="text-2xl font-bold">LockBlip</span>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setLocation('/auth')}
                data-testid="button-login-nav"
              >
                Log in
              </Button>
              <Button 
                onClick={() => setLocation('/auth')}
                className="bg-swapgreen hover:bg-swapgreen/90"
                data-testid="button-signup-nav"
              >
                Sign up
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                Message <span className="text-swapgreen">privately</span> with blockchain security
              </h1>
              <p className="text-xl text-muted-foreground">
                End-to-end encrypted messaging powered by blockchain technology. 
                Your conversations, protected by cryptography.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={() => setLocation('/auth')}
                  className="bg-swapgreen hover:bg-swapgreen/90 text-lg px-8 py-6"
                  data-testid="button-get-started"
                >
                  Get Started
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-6"
                  data-testid="button-learn-more"
                >
                  Learn More
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-swapgreen/20 rounded-3xl blur-3xl"></div>
              <img 
                src={heroImage} 
                alt="People messaging" 
                className="relative rounded-3xl shadow-2xl w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section 1 - Secure Messaging */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-midnight-light/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 md:order-1">
              <img 
                src={secureImage} 
                alt="Secure messaging" 
                className="rounded-3xl shadow-2xl w-full h-auto object-cover"
              />
            </div>
            <div className="space-y-6 order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-swapgreen/10 text-swapgreen">
                <Lock className="h-5 w-5" />
                <span className="font-semibold">Encrypted by Default</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold">
                Chat and call on a larger screen
              </h2>
              <p className="text-lg text-muted-foreground">
                Send and receive messages with military-grade encryption. 
                Your private conversations stay private with blockchain-verified security.
              </p>
              <Button 
                variant="outline" 
                className="gap-2"
                data-testid="button-download-app"
              >
                <Smartphone className="h-5 w-5" />
                Download the app
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section 2 - Group Chats */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-swapgreen/10 text-swapgreen">
                <Users className="h-5 w-5" />
                <span className="font-semibold">Group Messaging</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold">
                Never miss a moment with voice and video
              </h2>
              <p className="text-lg text-muted-foreground">
                Connect with friends, family, and communities in secure group chats. 
                Share moments knowing every message is protected by blockchain verification.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="mt-1 h-5 w-5 rounded-full bg-swapgreen/20 flex items-center justify-center flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-swapgreen"></div>
                  </div>
                  <span className="text-muted-foreground">Unlimited group size</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 h-5 w-5 rounded-full bg-swapgreen/20 flex items-center justify-center flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-swapgreen"></div>
                  </div>
                  <span className="text-muted-foreground">End-to-end encrypted group calls</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 h-5 w-5 rounded-full bg-swapgreen/20 flex items-center justify-center flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-swapgreen"></div>
                  </div>
                  <span className="text-muted-foreground">Admin controls and permissions</span>
                </li>
              </ul>
            </div>
            <div className="relative">
              <img 
                src={groupImage} 
                alt="Group video call" 
                className="rounded-3xl shadow-2xl w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section 3 - Blockchain Security */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-midnight/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 md:order-1">
              <div className="absolute inset-0 bg-swapgreen/10 rounded-3xl blur-3xl"></div>
              <img 
                src={encryptedImage} 
                alt="Encrypted messages" 
                className="relative rounded-3xl shadow-2xl w-full h-auto object-cover"
              />
            </div>
            <div className="space-y-6 order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-swapgreen/10 text-swapgreen">
                <Shield className="h-5 w-5" />
                <span className="font-semibold">Blockchain Powered</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold">
                Speak freely with verified security
              </h2>
              <p className="text-lg text-muted-foreground">
                Every message is recorded on an immutable blockchain ledger. 
                Verify message authenticity and ensure no one can tamper with your conversations.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border">
                  <MessageSquare className="h-8 w-8 text-swapgreen mb-2" />
                  <div className="font-semibold">Zero Knowledge</div>
                  <div className="text-sm text-muted-foreground">Complete privacy</div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border">
                  <Globe className="h-8 w-8 text-swapgreen mb-2" />
                  <div className="font-semibold">Decentralized</div>
                  <div className="text-sm text-muted-foreground">No central server</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">
            Keep in touch with your groups
          </h2>
          <p className="text-xl text-muted-foreground">
            Join millions of users who trust LockBlip for secure, blockchain-verified messaging.
          </p>
          <Button 
            size="lg" 
            onClick={() => setLocation('/auth')}
            className="bg-swapgreen hover:bg-swapgreen/90 text-lg px-12 py-6"
            data-testid="button-get-started-cta"
          >
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-midnight py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Features</a></li>
                <li><a href="#" className="hover:text-foreground">Security</a></li>
                <li><a href="#" className="hover:text-foreground">Download</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Blog</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
                <li><a href="#" className="hover:text-foreground">Privacy</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Terms</a></li>
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img src={lockblipLogo} alt="LockBlip" className="h-8 w-8 object-contain rounded-lg" />
              <span className="text-sm text-muted-foreground">© 2025 LockBlip. All rights reserved.</span>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground">Twitter</a>
              <a href="#" className="hover:text-foreground">GitHub</a>
              <a href="#" className="hover:text-foreground">Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
