import type { DialogData, DialogNode, DialogChoice } from '../types'

type DialogCallback = (event: string, data?: Record<string, unknown>) => void

/**
 * Dialog runner for handling NPC conversations and story sequences
 */
export class DialogRunner {
  private currentDialog: DialogData | null = null
  private currentNode: DialogNode | null = null
  private callback: DialogCallback

  constructor(callback: DialogCallback) {
    this.callback = callback
  }

  /**
   * Start a new dialog
   */
  start(dialog: DialogData): void {
    this.currentDialog = dialog
    this.currentNode = dialog.nodes[dialog.startNodeId]

    if (!this.currentNode) {
      console.error(`Dialog start node not found: ${dialog.startNodeId}`)
      return
    }

    this.emitNode()
  }

  /**
   * Get current dialog node
   */
  getCurrentNode(): DialogNode | null {
    return this.currentNode
  }

  /**
   * Check if dialog is active
   */
  isActive(): boolean {
    return this.currentDialog !== null && this.currentNode !== null
  }

  /**
   * Advance to next node (for linear dialog without choices)
   */
  advance(): void {
    if (!this.currentNode || !this.currentDialog) return

    if (this.currentNode.nextNodeId) {
      this.goToNode(this.currentNode.nextNodeId)
    } else if (!this.currentNode.choices || this.currentNode.choices.length === 0) {
      // End of dialog
      this.end()
    }
  }

  /**
   * Select a choice option
   */
  selectChoice(index: number): void {
    if (!this.currentNode?.choices || index >= this.currentNode.choices.length) {
      return
    }

    const choice = this.currentNode.choices[index]

    // Execute choice action if present
    if (choice.action) {
      this.callback('action', { action: choice.action })
    }

    if (choice.nextNodeId) {
      this.goToNode(choice.nextNodeId)
    } else {
      this.end()
    }
  }

  /**
   * Get available choices for current node
   */
  getChoices(): DialogChoice[] {
    if (!this.currentNode?.choices) return []

    // Filter choices by condition
    return this.currentNode.choices.filter((choice) => {
      if (!choice.condition) return true
      // TODO: Implement condition evaluation
      return true
    })
  }

  /**
   * Force end the dialog
   */
  end(): void {
    const dialogId = this.currentDialog?.id
    this.currentDialog = null
    this.currentNode = null
    this.callback('dialog_end', { dialogId })
  }

  private goToNode(nodeId: string): void {
    if (!this.currentDialog) return

    const node = this.currentDialog.nodes[nodeId]
    if (!node) {
      console.error(`Dialog node not found: ${nodeId}`)
      this.end()
      return
    }

    this.currentNode = node
    this.emitNode()
  }

  private emitNode(): void {
    if (!this.currentNode) return

    // Execute node action if present
    if (this.currentNode.action) {
      this.callback('action', { action: this.currentNode.action })
    }

    this.callback('node', {
      speaker: this.currentNode.speaker,
      portrait: this.currentNode.portrait,
      text: this.currentNode.text,
      choices: this.getChoices(),
      hasNext: !!this.currentNode.nextNodeId,
    })
  }
}
