import Phaser from 'phaser';

export class DialogRunner {
    private scene: Phaser.Scene;
    private dialogBox: Phaser.GameObjects.Container;
    private textObject: Phaser.GameObjects.Text;
    private isVisible: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.dialogBox = this.scene.add.container(0, 400);
        
        const bg = this.scene.add.rectangle(400, 100, 700, 150, 0x000000, 0.8);
        this.textObject = this.scene.add.text(60, 40, '', { fontSize: '20px', color: '#fff', wordWrap: { width: 680 } });
        
        this.dialogBox.add([bg, this.textObject]);
        this.dialogBox.setScrollFactor(0);
        this.dialogBox.setVisible(false);
        this.dialogBox.setDepth(100); // Ensure it's on top
    }

    showDialog(text: string) {
        this.textObject.setText(text);
        this.dialogBox.setVisible(true);
        this.isVisible = true;
    }

    hideDialog() {
        this.dialogBox.setVisible(false);
        this.isVisible = false;
    }

    isDialogVisible() {
        return this.isVisible;
    }
}
