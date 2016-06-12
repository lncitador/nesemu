import WindowManager from './window_manager.ts'

const Z_MENUBAR = 1000
const Z_MENU_SUBITEM = Z_MENUBAR + 1

function getOffsetRect(parent, target) {
  const prect = parent.getBoundingClientRect()
  const trect = target.getBoundingClientRect()
  return {
    left: trect.left - prect.left,
    top: trect.top - prect.top,
    right: trect.right - prect.left,
    bottom: trect.bottom - prect.top,
  }
}

export default class Wnd {
  public static HEADER_HEIGHT = 12

  protected callback: Function
  private root: HTMLElement
  private contentHolder: HTMLElement
  private titleBar: HTMLElement
  private titleElem: HTMLElement
  private menuBar: HTMLElement

  public constructor(protected wndMgr: WindowManager, width: number, height: number,
                     title: string)
  {
    this.callback = () => {}
    this.root = this.createRoot()
    this.root.className = 'wnd'
    this.root.style.position = 'absolute'
    this.setSize(width, height)

    this.createTitleBar(title)

    this.contentHolder = document.createElement('div')
    this.contentHolder.className = 'content-holder'
    this.root.appendChild(this.contentHolder)
  }

  public setContent(content: HTMLElement): Wnd {
    this.contentHolder.appendChild(content)
    return this
  }

  public setPos(x: number, y: number): Wnd {
    this.root.style.left = `${x}px`
    this.root.style.top = `${y}px`
    return this
  }

  public setTitle(title: string): Wnd {
    this.titleElem.innerText = title
    return this
  }

  public setSize(width: number, height: number): Wnd {
    this.root.style.width = `${width}px`
    this.root.style.height = `${height + Wnd.HEADER_HEIGHT}px`
    return this
  }

  public setCallback(callback: Function): Wnd {
    this.callback = callback
    return this
  }

  public setFocus(): Wnd {
    this.root.focus()
    return this
  }

  public addMenuBar(menu: any): Wnd {
    this.menuBar = document.createElement('div')
    this.menuBar.className = 'menu-bar'
    this.menuBar.style.zIndex = String(Z_MENUBAR)

    menu.forEach(menuItem => {
      const itemElem = document.createElement('div')
      itemElem.className = 'menu-item pull-left'
      itemElem.innerText = menuItem.label
      itemElem.addEventListener('click', (event) => {
        //event.stopPropagation()
        if ('submenu' in menuItem) {
          this.addSubmenu(menuItem, itemElem)
        }
      })
      this.menuBar.appendChild(itemElem)
      this.root.appendChild(this.menuBar)
    })

    return this
  }

  private addSubmenu(menuItem, itemElem) {
    const subItemHolder = document.createElement('div')
    subItemHolder.className = 'menu-subitem-holder'
    subItemHolder.style.zIndex = String(Z_MENU_SUBITEM)
    menuItem.submenu.forEach(submenuItem => {
      const subItemElem = document.createElement('div')
      subItemElem.className = 'menu-item'
      subItemElem.innerText = submenuItem.label
      subItemElem.addEventListener('click', (event) => {
        event.stopPropagation()
        if ('click' in submenuItem)
          submenuItem.click()
      })
      subItemHolder.appendChild(subItemElem)
    })
    this.root.appendChild(subItemHolder)

    const rect = getOffsetRect(this.root, itemElem)
    subItemHolder.style.left = `${rect.left - 1}px`  // For border size
    subItemHolder.style.top = `${rect.bottom - 1}px`

    // To handle earlier than menu open, pass useCapture=true
    const onClickOther = (event) => {
      subItemHolder.parentNode.removeChild(subItemHolder)
      document.removeEventListener('click', onClickOther, true)
    }
    document.addEventListener('click', onClickOther, true)
  }

  public getRootNode(): HTMLElement {
    return this.root
  }

  public close(): void {
    if (this.callback('close') === false)
      return  // Cancel close
    this.wndMgr.remove(this)
    this.root = null
  }

  public update(): void {
  }

  public addResizeBox() {
    this.root.classList.add('resizable')

    const W = 8

    const table = [
      {
        styleParams: { right: '-1px', bottom: '-1px', cursor: 'nwse-resize' },
        horz: 'right',
        vert: 'bottom',
      },
      {
        styleParams: { left: '-1px', bottom: '-1px', cursor: 'nesw-resize' },
        horz: 'left',
        vert: 'bottom',
      },
      {
        styleParams: { right: '-1px', top: '-1px', cursor: 'nesw-resize' },
        horz: 'right',
        vert: 'top',
      },
      {
        styleParams: { left: '-1px', top: '-1px', cursor: 'nwse-resize' },
        horz: 'left',
        vert: 'top',
      },
    ]

    const MIN_WIDTH = 64
    const MIN_HEIGHT = 24 + Wnd.HEADER_HEIGHT

    table.forEach(param => {
      const resizeBox = document.createElement('div')
      resizeBox.style.position = 'absolute'
      Object.keys(param.styleParams).forEach(key => {
        resizeBox.style[key] = param.styleParams[key]
      })
      resizeBox.style.width = resizeBox.style.height = `${W}px`
      resizeBox.style.zIndex = '100'

      let dragOfsX, dragOfsY
      const dragMove = (event) => {
        const [x, y] = this.getMousePosIn(event, this.root.parentNode as HTMLElement)
        const rect = this.root.getBoundingClientRect()
        const prect = (this.root.parentNode as HTMLElement).getBoundingClientRect()
        const box = {
          left: rect.left - prect.left,
          top: rect.top - prect.top,
          right: rect.right - prect.left,
          bottom: rect.bottom - prect.top,
        }
        box[param.horz] = x + dragOfsX
        box[param.vert] = y + dragOfsY

        let width = box.right - box.left - 2  // For border width.
        let height = box.bottom - box.top - 2
        if (width < MIN_WIDTH) {
          box[param.horz] -= (MIN_WIDTH - width) * (param.horz === 'left' ? 1 : -1)
        }
        if (height < MIN_HEIGHT) {
          box[param.vert] -= (MIN_HEIGHT - height) * (param.vert === 'top' ? 1 : -1)
        }
        this.root.style.width = `${box.right - box.left -  2}px`
        this.root.style.height = `${box.bottom - box.top - 2}px`
        this.root.style.left = `${box.left}px`
        this.root.style.top = `${box.top}px`
        this.callback('resize', width, height - Wnd.HEADER_HEIGHT)
      }
      const dragFinish = (event) => {
        document.removeEventListener('mousemove', dragMove)
        document.removeEventListener('mouseup', dragFinish)
      }

      resizeBox.addEventListener('mousedown', (event) => {
        event.stopPropagation()
        event.preventDefault()
        const [x, y] = this.getMousePosIn(event, resizeBox)
        dragOfsX = param.horz === 'left' ? -x : W - x
        dragOfsY = param.vert === 'top' ? -y : W - y

        document.addEventListener('mousemove', dragMove)
        document.addEventListener('mouseup', dragFinish)
        this.wndMgr.moveToTop(this)
      })
      this.root.appendChild(resizeBox)
    })
  }

  private createRoot(): HTMLElement {
    const root = document.createElement('div')
    root.addEventListener('mousedown', (event) => {
      event.stopPropagation()
      this.wndMgr.moveToTop(this)
      return false
    })
    return root
  }

  private createTitleBar(title: string): void {
    this.titleBar = document.createElement('div')
    this.titleBar.className = 'title-bar clearfix'

    this.addTitleButton(this.titleBar, 'close', () => {
      this.close()
    })
    this.titleElem = this.addTitle(this.titleBar, title)

    // Move window position with dragging.
    let dragOfsX, dragOfsY
    const dragMove = (event) => {
      const [x, y] = this.getMousePosIn(event, this.root.parentNode as HTMLElement)
      this.root.style.left = `${x + dragOfsX}px`
      this.root.style.top = `${y + dragOfsY}px`
    }
    const dragFinish = (event) => {
      document.removeEventListener('mousemove', dragMove)
      document.removeEventListener('mouseup', dragFinish)
    }
    this.titleBar.addEventListener('mousedown', (event) => {
      dragOfsX = dragOfsY = null
      if (event.button !== 0)
        return
      event.preventDefault()
      const [x, y] = this.getMousePosIn(event, this.root)
      dragOfsX = -x
      dragOfsY = -y
      document.addEventListener('mousemove', dragMove)
      document.addEventListener('mouseup', dragFinish)
      return true
    })

    this.root.appendChild(this.titleBar)
  }

  private addTitleButton(parent: HTMLElement, className: string,
                         clickCallback: EventListener): HTMLElement
  {
    const button = document.createElement('div')
    button.className = `${className} btn`
    button.addEventListener('click', clickCallback)
    button.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    parent.appendChild(button)
    return button
  }

  private addTitle(parent: HTMLElement, title: string): HTMLElement {
    const titleElem = document.createElement('div')
    titleElem.className = 'title'
    titleElem.appendChild(document.createTextNode(title))
    parent.appendChild(titleElem)
    return titleElem
  }

  private getMousePosIn(event: MouseEvent, elem: HTMLElement) {
    const rect = elem.getBoundingClientRect()
    const scrollLeft = document.body.scrollLeft
    const scrollTop = document.body.scrollTop
    return [event.pageX - rect.left - scrollLeft,
            event.pageY - rect.top - scrollTop]
  }
}
