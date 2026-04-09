import "preact";

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      screen: any;
      text: any;
      item: any;
      "gui-screen": any;
      "gui-item": any;
      "gui-trace": any;
      "gui-opened": any;
    }
  }
}
