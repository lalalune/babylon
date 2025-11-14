declare module 'sticky-sidebar-v2' {
  export default class StickySidebar {
    constructor(element: string | HTMLElement, options?: {
      topSpacing?: number
      bottomSpacing?: number
      containerSelector?: string | false
      innerWrapperSelector?: string
      resizeSensor?: boolean
      stickyClass?: string
      minWidth?: number
    })
    destroy(): void
    updateSticky(): void
  }
}

