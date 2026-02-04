// src/content/page-analyzer.ts

export interface PageInfo {
  url: string;
  title: string;
  domain: string;
}

export interface PageStructure {
  sidebar: {
    exists: boolean;
    selector: string | null;
    width: number;
    items: number;
  };
  mainContent: {
    exists: boolean;
    selector: string | null;
    width: number;
    type: string;
  };
  rightPanel: {
    exists: boolean;
    selector: string | null;
    width: number;
  };
}

export interface SessionItem {
  id: string;
  title: string;
  active: boolean;
  selector: string;
}

export interface ContentState {
  type: 'chat' | 'code' | 'settings' | 'empty' | 'unknown';
  status: 'idle' | 'loading' | 'streaming' | 'error' | 'unknown';
  hasInput: boolean;
  hasMessages: boolean;
}

export interface ElementInfo {
  exists: boolean;
  tagName: string;
  id: string;
  className: string;
  text: string;
  rect: { x: number; y: number; width: number; height: number };
  visible: boolean;
  clickable: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'unknown';
  content: string;
  index: number;
}

export class PageAnalyzer {
  /**
   * 获取页面基本信息
   */
  getPageInfo(): PageInfo {
    return {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
    };
  }

  /**
   * 分析页面结构
   */
  analyzeStructure(): PageStructure {
    // 尝试识别 Happy 工程页面的布局
    const sidebar = this.findSidebar();
    const mainContent = this.findMainContent();
    const rightPanel = this.findRightPanel();

    return {
      sidebar,
      mainContent,
      rightPanel,
    };
  }

  /**
   * 查找左侧边栏
   */
  private findSidebar(): PageStructure['sidebar'] {
    // Happy 工程页面使用的选择器
    // 基于 React Native Web 的动态类名，我们需要用结构特征来识别
    const selectors = [
      // Happy 特定选择器 - 左侧列表容器
      '[class*="unistyles_1t6kwioi2np"]', // 会话列表容器
      // 通用选择器
      '[data-testid="sidebar"]',
      '.sidebar',
      '#sidebar',
      'aside',
      'nav[class*="sidebar"]',
      'div[class*="sidebar"]',
      'div[class*="session-list"]',
      '[class*="nav-"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector) as HTMLElement;
      if (el && this.isVisible(el)) {
        const rect = el.getBoundingClientRect();
        // 查找可点击的会话项
        const items = el.querySelectorAll('[tabindex="0"], a, button, [role="button"]').length;
        return {
          exists: true,
          selector,
          width: rect.width,
          items,
        };
      }
    }

    // 备用方案：查找页面左侧区域（宽度小于 400px 且在左侧）
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      const rect = (div as HTMLElement).getBoundingClientRect();
      if (rect.left < 50 && rect.width > 100 && rect.width < 400 && rect.height > 300) {
        const clickableItems = div.querySelectorAll('[tabindex="0"]').length;
        if (clickableItems > 2) {
          return {
            exists: true,
            selector: this.generateSelector(div as HTMLElement),
            width: rect.width,
            items: clickableItems,
          };
        }
      }
    }

    return { exists: false, selector: null, width: 0, items: 0 };
  }

  /**
   * 查找主内容区
   */
  private findMainContent(): PageStructure['mainContent'] {
    const selectors = [
      '[data-testid="main-content"]',
      'main',
      '.main-content',
      '#main-content',
      '[class*="content-area"]',
      '[class*="chat-container"]',
      '[class*="message-list"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector) as HTMLElement;
      if (el && this.isVisible(el)) {
        const rect = el.getBoundingClientRect();
        const type = this.detectContentType(el);
        return {
          exists: true,
          selector,
          width: rect.width,
          type,
        };
      }
    }

    return { exists: false, selector: null, width: 0, type: 'unknown' };
  }

  /**
   * 查找右侧面板
   */
  private findRightPanel(): PageStructure['rightPanel'] {
    const selectors = [
      '[data-testid="right-panel"]',
      '.right-panel',
      '#right-panel',
      '[class*="debug-console"]',
      '[class*="side-panel"]',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector) as HTMLElement;
      if (el && this.isVisible(el)) {
        const rect = el.getBoundingClientRect();
        return {
          exists: true,
          selector,
          width: rect.width,
        };
      }
    }

    return { exists: false, selector: null, width: 0 };
  }

  /**
   * 检测内容类型
   */
  private detectContentType(el: HTMLElement): string {
    const html = el.innerHTML.toLowerCase();
    const classes = el.className.toLowerCase();

    if (classes.includes('chat') || html.includes('message') || html.includes('assistant')) {
      return 'chat';
    }
    if (classes.includes('code') || html.includes('<code') || html.includes('language-')) {
      return 'code';
    }
    if (classes.includes('setting') || classes.includes('config')) {
      return 'settings';
    }

    return 'content';
  }

  /**
   * 获取会话列表
   */
  getSessionsList(): SessionItem[] {
    const sessions: SessionItem[] = [];

    // Happy 工程页面特定选择器
    // 会话列表容器使用 unistyles_1t6kwioi2np 类
    // 每个会话项在容器内，使用 tabindex="0" 且有 r-1loqt21 类
    const sessionContainers = document.querySelectorAll('[class*="unistyles_1t6kwioi2np"]');

    sessionContainers.forEach((container) => {
      // 在每个容器内查找可点击的会话项
      const sessionItem = container.querySelector('[tabindex="0"][class*="r-1loqt21"]') as HTMLElement;
      if (sessionItem) {
        // 查找标题文本 - 使用 r-8akbws 类
        const titleEl = sessionItem.querySelector('[class*="r-8akbws"]') as HTMLElement;
        const title = titleEl?.textContent?.trim().substring(0, 50) || `会话 ${sessions.length + 1}`;

        // 检查是否是当前选中的会话
        // 选中的会话可能有不同的类名后缀
        const classList = sessionItem.className;
        const active = classList.includes('unistyles_29zjh1xkhz9') ||
                      sessionItem.getAttribute('aria-selected') === 'true';

        const id = sessionItem.id || `session-${sessions.length}`;

        sessions.push({
          id,
          title,
          active,
          selector: this.generateSelector(sessionItem),
        });
      }
    });

    if (sessions.length > 0) {
      return sessions;
    }

    // 备用方案：直接查找有标题的会话项
    const happySessionItems = document.querySelectorAll('[tabindex="0"][class*="r-1loqt21"]');

    happySessionItems.forEach((el) => {
      const htmlEl = el as HTMLElement;
      // 必须包含 r-8akbws 类的标题元素才是真正的会话项
      const titleEl = htmlEl.querySelector('[class*="r-8akbws"]') as HTMLElement;
      if (titleEl) {
        const title = titleEl.textContent?.trim().substring(0, 50) || `会话 ${sessions.length + 1}`;

        // 检查是否是当前选中的会话
        const active = htmlEl.getAttribute('aria-selected') === 'true' ||
                      htmlEl.classList.contains('active') ||
                      htmlEl.style.backgroundColor?.includes('rgb');

      }
    });

    if (sessions.length > 0) {
      return sessions;
    }

    // 通用选择器作为备用
    const selectors = [
      '[data-session-id]',
      '[class*="session-item"]',
      '[class*="conversation-item"]',
      '[class*="chat-item"]',
      'nav a',
      '.sidebar a',
      '.sidebar button',
      '[class*="list-item"]',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach((el, index) => {
          const htmlEl = el as HTMLElement;
          const id = htmlEl.dataset.sessionId || htmlEl.id || `item-${index}`;
          const title = htmlEl.textContent?.trim().substring(0, 50) || `Item ${index}`;
          const active = htmlEl.classList.contains('active') ||
                        htmlEl.getAttribute('aria-selected') === 'true' ||
                        htmlEl.classList.contains('selected');

          sessions.push({
            id,
            title,
            active,
            selector: this.generateSelector(htmlEl),
          });
        });
        break;
      }
    }

    return sessions;
  }

  /**
   * 获取内容区状态
   */
  getContentState(): ContentState {
    const state: ContentState = {
      type: 'unknown',
      status: 'unknown',
      hasInput: false,
      hasMessages: false,
    };

    // Happy 页面特定检测
    // 检测底部输入框（textarea with placeholder="输入消息..."）
    const happyInput = document.querySelector('textarea[placeholder*="输入消息"]') as HTMLTextAreaElement;
    if (happyInput && this.isVisible(happyInput)) {
      state.hasInput = true;
      state.type = 'chat';
    }

    // 检测内容类型
    if (state.type === 'unknown') {
      const chatSelectors = ['[class*="chat"]', '[class*="message"]', '[class*="conversation"]'];
      const codeSelectors = ['[class*="code"]', '[class*="editor"]', 'pre', 'code'];

      for (const selector of chatSelectors) {
        if (document.querySelector(selector)) {
          state.type = 'chat';
          break;
        }
      }

      if (state.type === 'unknown') {
        for (const selector of codeSelectors) {
          if (document.querySelector(selector)) {
            state.type = 'code';
            break;
          }
        }
      }
    }

    // 检测输入区域（如果还没检测到）
    if (!state.hasInput) {
      const inputSelectors = ['textarea', 'input[type="text"]', '[contenteditable="true"]', '[class*="input"]'];
      for (const selector of inputSelectors) {
        const input = document.querySelector(selector) as HTMLElement;
        if (input && this.isVisible(input)) {
          state.hasInput = true;
          break;
        }
      }
    }

    // 检测消息 - Happy 页面使用 unistyles 类名
    const happyMessages = document.querySelectorAll('[class*="unistyles_"][class*="message"], [class*="r-"][dir="auto"]');
    if (happyMessages.length > 5) {
      state.hasMessages = true;
    }

    if (!state.hasMessages) {
      const messageSelectors = ['[class*="message"]', '[class*="chat-bubble"]', '[role="article"]'];
      for (const selector of messageSelectors) {
        if (document.querySelectorAll(selector).length > 0) {
          state.hasMessages = true;
          break;
        }
      }
    }

    // 检测加载状态
    const loadingSelectors = ['[class*="loading"]', '[class*="spinner"]', '[class*="streaming"]'];
    for (const selector of loadingSelectors) {
      const el = document.querySelector(selector);
      if (el && this.isVisible(el as HTMLElement)) {
        state.status = 'loading';
        break;
      }
    }

    if (state.status === 'unknown') {
      state.status = state.hasMessages ? 'idle' : 'empty';
    }

    return state;
  }

  /**
   * 获取元素信息
   */
  getElementInfo(selector: string): ElementInfo {
    try {
      const el = document.querySelector(selector) as HTMLElement;
      if (!el) {
        return {
          exists: false,
          tagName: '',
          id: '',
          className: '',
          text: '',
          rect: { x: 0, y: 0, width: 0, height: 0 },
          visible: false,
          clickable: false,
        };
      }

      const rect = el.getBoundingClientRect();
      const isClickable = el.tagName === 'BUTTON' ||
                         el.tagName === 'A' ||
                         el.getAttribute('role') === 'button' ||
                         el.onclick !== null ||
                         window.getComputedStyle(el).cursor === 'pointer';

      return {
        exists: true,
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        text: el.textContent?.trim().substring(0, 100) || '',
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        visible: this.isVisible(el),
        clickable: isClickable,
      };
    } catch {
      return {
        exists: false,
        tagName: '',
        id: '',
        className: '',
        text: '',
        rect: { x: 0, y: 0, width: 0, height: 0 },
        visible: false,
        clickable: false,
      };
    }
  }

  /**
   * 高亮元素
   */
  highlightElement(selector: string, duration = 2000): boolean {
    try {
      const el = document.querySelector(selector) as HTMLElement;
      if (!el) return false;

      const originalOutline = el.style.outline;
      const originalBackground = el.style.backgroundColor;

      el.style.outline = '3px solid #ff0000';
      el.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';

      setTimeout(() => {
        el.style.outline = originalOutline;
        el.style.backgroundColor = originalBackground;
      }, duration);

      // 滚动到元素
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 点击元素
   */
  clickElement(selector: string): boolean {
    try {
      const el = document.querySelector(selector) as HTMLElement;
      if (!el) return false;

      el.click();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 向元素输入文本
   * 支持 Happy 页面的 React Native Web textarea
   */
  inputText(selector: string, text: string): boolean {
    try {
      let el: HTMLInputElement | HTMLTextAreaElement | null = null;

      // 特殊处理：如果选择器是 'happy-input'，自动找到 Happy 的输入框
      if (selector === 'happy-input' || selector === 'textarea') {
        el = document.querySelector('textarea[placeholder*="输入消息"]') as HTMLTextAreaElement;
      } else {
        el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      }

      if (!el) return false;

      el.focus();

      // 使用 React 兼容的方式设置值
      // React Native Web 使用受控组件，需要触发正确的事件
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, text);
      } else {
        el.value = text;
      }

      // 触发多个事件以确保 React 捕获到变化
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      const changeEvent = new Event('change', { bubbles: true, cancelable: true });

      el.dispatchEvent(inputEvent);
      el.dispatchEvent(changeEvent);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清空输入框
   */
  clearInput(): boolean {
    return this.inputText('happy-input', '');
  }

  /**
   * 模拟发送消息（点击发送按钮或触发提交）
   */
  simulateSend(): boolean {
    try {
      // 查找发送按钮 - Happy 页面可能使用图标按钮
      // 通常发送按钮在输入框附近
      const sendButtonSelectors = [
        'button[type="submit"]',
        '[class*="send"]',
        '[aria-label*="send"]',
        '[aria-label*="发送"]',
        // Happy 页面的语音/发送按钮区域
        'textarea[placeholder*="输入消息"]',
      ];

      // 尝试找到发送按钮
      for (const selector of sendButtonSelectors) {
        const btn = document.querySelector(selector) as HTMLElement;
        if (btn && this.isVisible(btn)) {
          // 如果是 textarea，模拟 Enter 键
          if (btn.tagName === 'TEXTAREA') {
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
            });
            btn.dispatchEvent(enterEvent);
            return true;
          }
          btn.click();
          return true;
        }
      }

      // 备用方案：在输入框上触发 Enter 键
      const input = document.querySelector('textarea[placeholder*="输入消息"]') as HTMLTextAreaElement;
      if (input) {
        input.focus();
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        });
        input.dispatchEvent(enterEvent);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 读取聊天内容
   * 返回当前对话框中的所有消息
   */
  getChatMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Happy 页面聊天消息的可能选择器
    // 基于 React Native Web 结构，消息通常在特定容器中

    // 尝试找到消息容器
    // 查找包含 dir="auto" 的文本元素，这些通常是消息内容
    const messageContainers = document.querySelectorAll('[dir="auto"]');

    // 过滤出实际的聊天消息（排除 UI 元素如按钮文字等）
    let messageIndex = 0;
    messageContainers.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const text = htmlEl.textContent?.trim() || '';

      // 过滤条件：
      // 1. 文本长度大于 5（排除短按钮文字）
      // 2. 元素在页面中间区域（排除侧边栏）
      // 3. 不是输入框内的文字
      const rect = htmlEl.getBoundingClientRect();
      const isInMainArea = rect.left > 200 && rect.width > 100;
      const isLongEnough = text.length > 5;
      const isNotInput = !htmlEl.closest('textarea') && !htmlEl.closest('input');

      if (isLongEnough && isInMainArea && isNotInput) {
        // 尝试判断消息角色
        // 通常用户消息和助手消息有不同的样式/位置
        const parent = htmlEl.closest('[class*="unistyles_"]') as HTMLElement;
        let role: ChatMessage['role'] = 'unknown';

        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          const screenCenter = window.innerWidth / 2;

          // 简单启发式：靠右的可能是用户消息，靠左的是助手消息
          // 这需要根据实际页面调整
          if (parentRect.left > screenCenter - 100) {
            role = 'user';
          } else {
            role = 'assistant';
          }
        }

        messages.push({
          role,
          content: text.substring(0, 500), // 限制长度
          index: messageIndex++,
        });
      }
    });

    // 如果上面的方法没找到消息，尝试其他选择器
    if (messages.length === 0) {
      // 尝试查找 class 中包含 message 的元素
      const altMessages = document.querySelectorAll('[class*="message"], [class*="chat-bubble"], [role="article"]');
      altMessages.forEach((el, index) => {
        const text = (el as HTMLElement).textContent?.trim() || '';
        if (text.length > 5) {
          messages.push({
            role: 'unknown',
            content: text.substring(0, 500),
            index,
          });
        }
      });
    }

    return messages;
  }

  /**
   * 获取输入框当前内容
   */
  getInputValue(): string {
    const input = document.querySelector('textarea[placeholder*="输入消息"]') as HTMLTextAreaElement;
    return input?.value || '';
  }

  /**
   * 检查元素是否可见
   */
  private isVisible(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           rect.width > 0 &&
           rect.height > 0;
  }

  /**
   * 生成元素选择器
   */
  private generateSelector(el: HTMLElement): string {
    if (el.id) {
      return `#${el.id}`;
    }

    if (el.dataset.sessionId) {
      return `[data-session-id="${el.dataset.sessionId}"]`;
    }

    // 尝试使用 class
    if (el.className) {
      const classes = el.className.split(' ').filter((c) => c && !c.includes(':'));
      if (classes.length > 0) {
        return `${el.tagName.toLowerCase()}.${classes[0]}`;
      }
    }

    // 使用 nth-child
    const parent = el.parentElement;
    if (parent) {
      const index = Array.from(parent.children).indexOf(el) + 1;
      return `${el.tagName.toLowerCase()}:nth-child(${index})`;
    }

    return el.tagName.toLowerCase();
  }
}
