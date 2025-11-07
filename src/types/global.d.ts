// types/globals.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      // Add any known props (optional)
      theme?: 'light' | 'dark';
      size?: 'small' | 'medium' | 'large';
    };
  }
}