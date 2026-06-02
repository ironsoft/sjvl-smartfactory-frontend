declare module "qrcode" {
  function toDataURL(
    text: string,
    options?: { width?: number; margin?: number }
  ): Promise<string>;
}
