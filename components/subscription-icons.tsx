// SVG Icons for popular subscription services
// Each icon is an inline SVG component for consistent styling

export interface SubscriptionIconProps {
  className?: string;
  size?: number;
}

// Netflix
export const NetflixIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24zm8.489 0v9.63L18.6 22.951c-.043-7.86-.004-15.913.002-22.95zM5.398 1.05V24c1.873-.225 2.81-.312 4.715-.398v-9.22z" />
  </svg>
);

// Spotify
export const SpotifyIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

// Apple
export const AppleIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

// YouTube / YouTube Premium
export const YouTubeIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

// Disney+
export const DisneyPlusIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M1.175 13.647c-.196-.27-.27-.442-.27-.615 0-.22.123-.393.344-.393h.123c.86.025 3.218.098 5.674.098.393 0 .566-.123.59-.418.05-.615.05-1.304.05-2.04 0-.54-.024-.517-.565-.517H5.87c-.516 0-.54-.024-.54-.467v-.172c0-.393.024-.467.54-.467h1.254c.516 0 .54-.024.54-.515V6.17c0-.566.023-.59.565-.59h.246c.467 0 .516.024.516.59v1.95c0 .54.025.516.566.516h1.18c.565 0 .59.024.59.566v.172c0 .442-.025.467-.59.467h-1.18c-.541 0-.566-.024-.566.516v1.845c0 .59.05.615.565.664 2.162.172 4.397.197 5.797.197 1.697 0 3.296-.098 4.545-.123.147 0 .295.05.295.221 0 .172-.074.344-.27.59-.27.345-1.303 1.5-3.712 1.5-1.427 0-2.926-.123-4.274-.172-.59-.024-.614-.05-.614.516v1.328c0 .615-.025.59-.59.59h-.197c-.516 0-.516-.024-.516-.59v-1.377c0-.516-.024-.541-.54-.565-2.408-.123-5.06-.295-6.75-.74-1.622-.418-1.892-.957-2.064-1.254zm16.1-2.065c-.098-.393.024-.467.344-.27 1.525.934 3.983 2.755 4.89 4.03.147.172.098.393-.049.516-.123.098-.344.172-.541.172-2.138 0-4.177-.369-4.546-3.886-.025-.172-.073-.393-.098-.562z" />
  </svg>
);

// Amazon Prime
export const AmazonIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.485.126a.392.392 0 0 1-.022.463c-.211.286-.478.456-.8.51-1.453.245-2.937.433-4.453.57-1.98.182-3.87.2-5.686.054-1.753-.154-3.525-.424-5.313-.813-1.633-.354-3.25-.822-4.85-1.402a.422.422 0 0 1-.275-.391.39.39 0 0 1 .04-.396zm6.793-9.103c0-1.2.156-2.313.465-3.34a7.944 7.944 0 0 1 1.327-2.678 6.142 6.142 0 0 1 2.067-1.752 5.64 5.64 0 0 1 2.715-.645c1.61 0 2.907.508 3.896 1.522.99 1.015 1.485 2.378 1.485 4.09 0 1.66-.48 3.074-1.44 4.242-.96 1.168-2.23 1.752-3.81 1.752-.586 0-1.14-.124-1.66-.37a3.43 3.43 0 0 1-1.272-.99l-.39 1.112c-.057.165-.15.282-.274.352-.12.07-.3.105-.537.105h-.755c-.242 0-.41-.08-.5-.244-.092-.164-.138-.416-.138-.754V8.917zm3.977 2.07c.6 0 1.12-.253 1.557-.758.436-.505.654-1.23.654-2.176 0-.893-.2-1.63-.6-2.21-.4-.58-.924-.87-1.57-.87-.606 0-1.11.248-1.515.746-.403.497-.605 1.195-.605 2.095 0 .907.2 1.64.6 2.195.4.555.904.832 1.515.832h-.036v.147zm10.03-6.2c.273 0 .475.107.604.32s.195.547.195.98v5.024c0 .435-.065.762-.195.98s-.33.326-.604.326h-.8c-.273 0-.473-.11-.602-.326-.127-.22-.192-.545-.192-.98V6.088c0-.436.065-.764.192-.98.128-.217.33-.326.602-.326h.8z" />
  </svg>
);

// HBO Max
export const HBOIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.042 16.896H4.414v-3.754H2.708v3.754H.071V7.104h2.637v3.662h1.706V7.104h2.628zM12.417 16.896h-2.628v-9.79h2.628zm8.182-6.236c0 1.64-1.09 2.91-2.628 2.91h-.828v3.326H14.42V7.104h3.45c1.538 0 2.628 1.272 2.628 2.912v.644zm-2.628-.322v-.644c0-.368-.27-.644-.622-.644h-.828v1.932h.828c.352 0 .622-.276.622-.644zM24 12.792c0 2.112-1.71 3.81-3.81 3.81-.552 0-1.08-.12-1.554-.336v.336h-2.628V7.104h2.628v.336c.474-.216 1.002-.336 1.554-.336C22.29 7.104 24 8.802 24 10.914v1.878zm-2.628-.938v-.938c0-.668-.526-1.206-1.182-1.206-.654 0-1.182.538-1.182 1.206v.938c0 .668.528 1.206 1.182 1.206.656 0 1.182-.538 1.182-1.206z" />
  </svg>
);

// Hulu
export const HuluIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.4 2.4v19.2h6V12c0-1.2.6-1.8 1.8-1.8h1.2c1.2 0 1.8.6 1.8 1.8v9.6h6v-12c0-3.6-2.4-6-6-6h-1.2c-1.8 0-3.6.6-4.8 1.8V2.4z" />
  </svg>
);

// Adobe Creative Cloud
export const AdobeIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.966 22.624l-1.69-4.281H8.122l3.892-9.144 5.662 13.425zM8.884 1.376H0v21.248zm6.232 0L24 22.624V1.376z" />
  </svg>
);

// Microsoft 365
export const MicrosoftIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
  </svg>
);

// Google (Google One, YouTube Music, etc.)
export const GoogleIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053z" />
  </svg>
);

// Dropbox
export const DropboxIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zm-12 11.07l6 3.822 6-3.822-6-3.822-6 3.822zm12-3.822l-6 3.822v7.644l6-3.822v-7.644zm-12 0v7.644l6 3.822v-7.644l-6-3.822z" />
  </svg>
);

// iCloud
export const iCloudIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
  </svg>
);

// Notion
export const NotionIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 2.02c-.42-.326-.98-.7-2.055-.607L3.01 2.7c-.466.046-.56.28-.374.466l1.823 1.042zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.747 0-.933-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933l3.222-.187zM2.668 1.32L16.72.027c1.682-.14 2.1.093 2.8.606l3.876 2.708c.56.42.747.933.747 1.54v16.49c0 1.026-.373 1.634-1.68 1.726L5.754 24c-.98.047-1.448-.093-1.962-.747L.56 19.513c-.56-.747-.793-1.307-.793-1.96V2.953c0-.84.373-1.54 1.12-1.634z" />
  </svg>
);

// Slack
export const SlackIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
);

// Zoom
export const ZoomIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4.585 9.668a.72.72 0 0 0-.72.72v2.788c0 .397.322.72.72.72h5.358c.397 0 .72.321.72.72v.36c0 .397-.323.72-.72.72H3.145a.72.72 0 0 1-.72-.72V9.668c0-.398.322-.72.72-.72h5.358a.72.72 0 0 1 .72.72v.36a.72.72 0 0 1-.72.72H4.585zm15.271-2.944a.72.72 0 0 1 .72.72v9.112a.72.72 0 0 1-.72.72h-5.358a.72.72 0 0 1-.72-.72V7.444c0-.398.322-.72.72-.72h5.358zm-2.249 7.232V9.98a.72.72 0 0 0-.72-.72h-1.67a.72.72 0 0 0-.72.72v3.976c0 .397.323.72.72.72h1.67a.72.72 0 0 0 .72-.72z" />
  </svg>
);

// NordVPN / VPN services
export const VPNIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
  </svg>
);

// Gym/Fitness (Planet Fitness, etc.)
export const FitnessIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
  </svg>
);

// Duolingo
export const DuolingoIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.001 24c-1.404 0-2.693-.354-3.869-1.063a10.683 10.683 0 0 1-3.089-2.888.572.572 0 0 1 .473-.896c.173 0 .334.08.443.214.836 1.032 1.858 1.87 3.067 2.517a7.987 7.987 0 0 0 5.95 0c1.209-.647 2.231-1.485 3.067-2.517a.566.566 0 0 1 .443-.214.572.572 0 0 1 .473.896 10.683 10.683 0 0 1-3.089 2.888c-1.176.709-2.465 1.063-3.869 1.063zm7.407-8.594c-.163 0-.32-.07-.432-.191a4.816 4.816 0 0 0-1.6-1.163 4.326 4.326 0 0 0-1.886-.428c-.667 0-1.303.143-1.909.428a4.846 4.846 0 0 0-1.577 1.163.578.578 0 0 1-.433.191.573.573 0 0 1-.432-.956 5.943 5.943 0 0 1 1.966-1.449 5.483 5.483 0 0 1 2.385-.534c.834 0 1.629.178 2.385.534a5.943 5.943 0 0 1 1.966 1.449.573.573 0 0 1-.433.956zm-14.814 0a.573.573 0 0 1-.433-.956 5.943 5.943 0 0 1 1.966-1.449 5.483 5.483 0 0 1 2.385-.534c.834 0 1.629.178 2.385.534a5.943 5.943 0 0 1 1.966 1.449.573.573 0 0 1-.433.956.578.578 0 0 1-.432-.191 4.816 4.816 0 0 0-1.6-1.163 4.326 4.326 0 0 0-1.886-.428c-.667 0-1.303.143-1.909.428a4.846 4.846 0 0 0-1.577 1.163.578.578 0 0 1-.432.191zM12 19.765c-1.078 0-2.1-.193-3.068-.579a7.825 7.825 0 0 1-2.542-1.628.56.56 0 0 1-.166-.408c0-.319.254-.572.573-.572.159 0 .31.063.42.178a6.71 6.71 0 0 0 2.174 1.393c.828.33 1.7.496 2.609.496s1.781-.166 2.609-.496a6.71 6.71 0 0 0 2.174-1.393.566.566 0 0 1 .42-.178c.319 0 .573.253.573.572a.56.56 0 0 1-.166.408 7.825 7.825 0 0 1-2.542 1.628c-.967.386-1.99.579-3.068.579zM5.994 10.79a2.584 2.584 0 0 1 0-5.168 2.584 2.584 0 0 1 0 5.168zm12.012 0a2.584 2.584 0 0 1 0-5.168 2.584 2.584 0 0 1 0 5.168z" />
  </svg>
);

// Headspace / Meditation apps
export const HeadspaceIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

// Strava
export const StravaIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
  </svg>
);

// 1Password / Password managers
export const PasswordManagerIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1C8.676 1 6 3.676 6 7v2H4v14h16V9h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4zm0 10c1.1 0 2 .9 2 2 0 .74-.4 1.38-1 1.72V19h-2v-2.28c-.6-.35-1-.98-1-1.72 0-1.1.9-2 2-2z" />
  </svg>
);

// ChatGPT / AI Services
export const AIServiceIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);

// YNAB (You Need A Budget)
export const YNABIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

// Generic subscription icon (for unknown services)
export const GenericSubscriptionIcon = ({ className = '', size = 24 }: SubscriptionIconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// Map of service names to their icons
export const subscriptionIconMap: Record<string, React.FC<SubscriptionIconProps>> = {
  // Streaming
  'netflix': NetflixIcon,
  'spotify': SpotifyIcon,
  'apple': AppleIcon,
  'apple music': AppleIcon,
  'apple tv': AppleIcon,
  'apple one': AppleIcon,
  'itunes': AppleIcon,
  'app store': AppleIcon,
  'youtube': YouTubeIcon,
  'youtube premium': YouTubeIcon,
  'youtube music': YouTubeIcon,
  'disney': DisneyPlusIcon,
  'disney+': DisneyPlusIcon,
  'disneyplus': DisneyPlusIcon,
  'amazon': AmazonIcon,
  'amazon prime': AmazonIcon,
  'prime video': AmazonIcon,
  'hbo': HBOIcon,
  'hbo max': HBOIcon,
  'max': HBOIcon,
  'hulu': HuluIcon,
  
  // Productivity
  'adobe': AdobeIcon,
  'creative cloud': AdobeIcon,
  'microsoft': MicrosoftIcon,
  'office 365': MicrosoftIcon,
  'microsoft 365': MicrosoftIcon,
  'google': GoogleIcon,
  'google one': GoogleIcon,
  'google play': GoogleIcon,
  'dropbox': DropboxIcon,
  'icloud': iCloudIcon,
  'notion': NotionIcon,
  'slack': SlackIcon,
  'zoom': ZoomIcon,
  
  // Security & VPN
  'nordvpn': VPNIcon,
  'expressvpn': VPNIcon,
  'surfshark': VPNIcon,
  'vpn': VPNIcon,
  '1password': PasswordManagerIcon,
  'lastpass': PasswordManagerIcon,
  'dashlane': PasswordManagerIcon,
  'bitwarden': PasswordManagerIcon,
  
  // Health & Fitness
  'planet fitness': FitnessIcon,
  'gym': FitnessIcon,
  'fitness': FitnessIcon,
  'peloton': FitnessIcon,
  'duolingo': DuolingoIcon,
  'headspace': HeadspaceIcon,
  'calm': HeadspaceIcon,
  'meditation': HeadspaceIcon,
  'strava': StravaIcon,
  
  // AI Services
  'chatgpt': AIServiceIcon,
  'openai': AIServiceIcon,
  'claude': AIServiceIcon,
  'anthropic': AIServiceIcon,
  'midjourney': AIServiceIcon,
  
  // Finance
  'ynab': YNABIcon,
};

// Color palette for subscription boxes (pastel colors like in the screenshot)
export const subscriptionColors = [
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-900 dark:text-amber-100' },
  { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-900 dark:text-violet-100' },
  { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-900 dark:text-red-100' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-900 dark:text-emerald-100' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-900 dark:text-rose-100' },
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-900 dark:text-blue-100' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-900 dark:text-orange-100' },
  { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-900 dark:text-teal-100' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-900 dark:text-purple-100' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-900 dark:text-cyan-100' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-900 dark:text-pink-100' },
  { bg: 'bg-lime-100 dark:bg-lime-900/30', text: 'text-lime-900 dark:text-lime-100' },
];

/**
 * Get the icon component for a subscription service
 * Matches against the merchant name (case-insensitive, partial match)
 */
export function getSubscriptionIcon(merchantName: string): React.FC<SubscriptionIconProps> | null {
  const normalizedName = merchantName.toLowerCase();
  
  // Try exact match first
  if (subscriptionIconMap[normalizedName]) {
    return subscriptionIconMap[normalizedName];
  }
  
  // Try partial match
  for (const [key, icon] of Object.entries(subscriptionIconMap)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return icon;
    }
  }
  
  return null;
}

/**
 * Get a consistent color for a subscription based on its index
 */
export function getSubscriptionColor(index: number) {
  return subscriptionColors[index % subscriptionColors.length];
}
