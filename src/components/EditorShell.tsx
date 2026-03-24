import { Canvas } from './Canvas';
import { LayerPanel } from './LayerPanel';
import { MaterialPanel } from './MaterialPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { TemplatePanel } from './TemplatePanel';
import { Topbar } from './Topbar';
import { useEditorStore } from '../store/editorStore';

export function EditorShell() {
  const mode = useEditorStore((state) => state.mode);
  const isPreview = mode === 'preview';

  return (
    <div className="editor-shell">
      <Topbar />

      <div className={`workspace ${isPreview ? 'preview-layout' : ''}`}>
        {!isPreview ? (
          <div className="left-sticky-column">
            <TemplatePanel />
            <MaterialPanel />
          </div>
        ) : null}

        <Canvas />

        {!isPreview ? (
          <div className="right-sticky-column">
            <LayerPanel />
            <PropertiesPanel />
          </div>
        ) : null}
      </div>
    </div>
  );
}
