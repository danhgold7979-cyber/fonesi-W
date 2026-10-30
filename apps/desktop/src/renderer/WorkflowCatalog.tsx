import { useState } from 'react';
import { Dialog } from './components.js';
import { FACEBOOK_WORKFLOW_TEMPLATES } from './workflow-catalog.js';
import type { FacebookWorkflowTemplate } from './workflow-catalog.js';

export function WorkflowCatalog() {
  const [selected, setSelected] = useState<FacebookWorkflowTemplate | null>(null);

  return (
    <section className="workflow-catalog-section" aria-labelledby="facebook-workflows-heading">
      <div className="workflow-catalog-heading">
        <div>
          <h1 id="facebook-workflows-heading">Quy trình Facebook</h1>
          <p>
            Chọn đúng loại bài đăng. Mỗi mẫu có đích đăng, dữ liệu đầu vào và thứ tự xử lý cố định.
          </p>
        </div>
        <span className="workflow-catalog-count">04 quy trình</span>
      </div>

      <div className="workflow-template-grid">
        {FACEBOOK_WORKFLOW_TEMPLATES.map((template) => (
          <article
            className="workflow-template-card"
            data-testid="workflow-template-card"
            data-template-id={template.id}
            key={template.id}
          >
            <div className="workflow-template-card-top">
              <span className="workflow-template-app" aria-label="Facebook">
                f
              </span>
              <span className="workflow-template-status">Chưa sẵn sàng chạy</span>
            </div>
            <div className="workflow-template-card-copy">
              <h2>{template.name}</h2>
              <p>{template.summary}</p>
            </div>
            <dl className="workflow-template-meta">
              <div>
                <dt>Đích đăng</dt>
                <dd>{template.targetKind}</dd>
              </div>
              <div>
                <dt>Media</dt>
                <dd>{template.mediaLabel}</dd>
              </div>
              <div>
                <dt>Nội dung</dt>
                <dd>Caption · Hashtag · Bình luận</dd>
              </div>
            </dl>
            <div className="workflow-template-tags" aria-label="Dữ liệu bắt buộc">
              <span>Caption</span>
              <span>Hashtag</span>
              <span>1–32 bình luận</span>
            </div>
            <button
              className="workflow-template-open"
              type="button"
              onClick={() => setSelected(template)}
            >
              Xem quy trình
            </button>
          </article>
        ))}
      </div>

      {selected && (
        <Dialog title={selected.name} close={() => setSelected(null)} wide>
          <div className="workflow-template-detail" data-testid="workflow-template-detail">
            <div className="workflow-template-warning" role="status">
              PLANNED · Chưa sẵn sàng chạy thật. Đây là đặc tả quy trình; Facebook adapter, xác minh
              tài khoản/đích đăng và nghiệm thu trên điện thoại thật còn phải triển khai.
            </div>

            <p>{selected.summary}</p>

            <div className="workflow-template-detail-grid">
              <section>
                <h3>Định danh cần xác minh</h3>
                <dl className="workflow-template-detail-meta">
                  <div>
                    <dt>Nền tảng</dt>
                    <dd>Facebook · com.facebook.katana</dd>
                  </div>
                  <div>
                    <dt>Nick đang đăng nhập</dt>
                    <dd>Profile cá nhân trên điện thoại</dd>
                  </div>
                  <div>
                    <dt>Đích đăng</dt>
                    <dd>{selected.targetKind} · phải xác minh riêng</dd>
                  </div>
                  <div>
                    <dt>Loại media</dt>
                    <dd>{selected.mediaLabel}</dd>
                  </div>
                </dl>
                <p className="workflow-template-hint">
                  Một điện thoại có thể có nhiều profile, nhưng mỗi Process phải ghim đúng profile
                  đăng nhập và đúng đích đăng. Cơ chế quét/chuyển nick thực tế chưa được chứng nhận.
                </p>
              </section>

              <section>
                <h3>Dữ liệu phải chuẩn bị</h3>
                <ul className="workflow-template-inputs">
                  {selected.requiredInputs.map((input) => (
                    <li key={input.label}>
                      <strong>{input.label}</strong>
                      <span>{input.detail}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="workflow-template-detail-section">
              <h3>Thứ tự thực hiện cố định</h3>
              <ol className="workflow-template-steps">
                {selected.steps.map((step, index) => (
                  <li key={step}>
                    <span className="workflow-template-step-number">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="workflow-template-detail-section">
              <h3>Điều kiện bắt buộc phải dừng</h3>
              <ul className="workflow-template-stop-rules">
                {selected.stopRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>

            <div className="workflow-template-comment-rule">
              <strong>Quy tắc bình luận:</strong> danh sách 1–32 bình luận là bắt buộc và được giữ
              nguyên thứ tự. Chỉ gửi bình luận sau khi bài đăng đã được xác minh trên đúng Fanpage
              hoặc Group.
            </div>

            <div className="dialog-actions">
              <button type="button" onClick={() => setSelected(null)}>
                Đóng
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
