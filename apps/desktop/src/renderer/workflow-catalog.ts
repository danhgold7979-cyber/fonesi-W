export type FacebookWorkflowTemplateId =
  | 'facebook-page-video-comments'
  | 'facebook-page-photo-comments'
  | 'facebook-page-reels-comments'
  | 'facebook-group-post-comments';

export interface FacebookWorkflowTemplate {
  id: FacebookWorkflowTemplateId;
  name: string;
  targetKind: 'Fanpage' | 'Nhóm Facebook';
  mediaLabel: string;
  summary: string;
  requiredInputs: readonly { label: string; detail: string }[];
  steps: readonly string[];
  stopRules: readonly string[];
}

const commonInputs = [
  {
    label: 'Điện thoại Android',
    detail: 'Chọn đúng điện thoại; mỗi điện thoại chỉ chạy một job automation tại một thời điểm.',
  },
  {
    label: 'Nick Facebook đang đăng nhập',
    detail: 'Xác minh profile cá nhân đang active trên app; không định danh chỉ bằng tên hiển thị.',
  },
  {
    label: 'Caption và hashtag',
    detail: 'Hai trường riêng biệt; giữ nguyên nội dung đã duyệt khi đóng băng job.',
  },
  {
    label: 'Danh sách bình luận',
    detail: 'Bắt buộc 1–32 bình luận dạng văn bản, giữ nguyên thứ tự đã nhập.',
  },
  {
    label: 'Lịch đăng',
    detail: 'Lập lịch theo Process gắn với điện thoại, nick đăng nhập và đích đăng cụ thể.',
  },
] as const;

const commonSteps = [
  'Kiểm tra điện thoại đã kết nối, được bật và không bị phiên thao tác khác chiếm quyền.',
  'Mở Facebook và xác minh đúng nick cá nhân đang đăng nhập trên điện thoại.',
  'Xác minh đúng đích đăng bằng định danh ổn định; không chọn chỉ dựa vào tên hiển thị.',
  'Quét thư mục media, kiểm tra file đã ổn định, đúng loại và đúng thứ tự.',
  'Đóng băng caption, hashtag, media và danh sách bình luận theo job đã lên lịch.',
  'Chạy preflight; thiếu tài khoản, đích đăng, media hoặc bình luận thì chặn trước khi đăng.',
  'Thực hiện đăng đúng một lần và chờ tín hiệu xác minh bài đăng trên đúng đích.',
  'Chỉ sau khi bài đăng được xác minh mới lần lượt gửi từng bình luận theo thứ tự.',
  'Xác minh từng bình luận, lưu kết quả từng mục và tổng kết lịch sử job.',
] as const;

const commonStopRules = [
  'Nick đăng nhập hoặc đích đăng không xác minh được: dừng trước thao tác đăng.',
  'Kết quả đăng chưa rõ hoặc đang cần review: không gửi bình luận và không tự đăng lại.',
  'Bài đã xác minh nhưng bình luận lỗi: chỉ xử lý bình luận còn thiếu; không đăng lại bài.',
  'Điện thoại mất kết nối, đổi app/version hoặc profile không còn khớp chứng nhận: dừng job.',
] as const;

function inputsForTarget(
  targetLabel: string,
  targetDetail: string,
  mediaDetail: string,
): FacebookWorkflowTemplate['requiredInputs'] {
  return [
    commonInputs[0],
    commonInputs[1],
    { label: targetLabel, detail: targetDetail },
    { label: 'Thư mục media', detail: mediaDetail },
    commonInputs[2],
    commonInputs[3],
    commonInputs[4],
  ];
}

export const FACEBOOK_WORKFLOW_TEMPLATES: readonly FacebookWorkflowTemplate[] = [
  {
    id: 'facebook-page-video-comments',
    name: 'Đăng video Fanpage + bình luận',
    targetKind: 'Fanpage',
    mediaLabel: '01 video',
    summary: 'Đăng video lên đúng Fanpage, sau đó đăng và xác minh từng bình luận theo danh sách.',
    requiredInputs: inputsForTarget(
      'Fanpage đích',
      'Chọn Fanpage cụ thể mà nick đăng nhập có quyền đăng; xác minh đúng Page trước khi gửi.',
      'Quét folder, lọc video hợp lệ và ghép từng video với một bộ nội dung.',
    ),
    steps: commonSteps,
    stopRules: commonStopRules,
  },
  {
    id: 'facebook-page-photo-comments',
    name: 'Đăng ảnh Fanpage + bình luận',
    targetKind: 'Fanpage',
    mediaLabel: 'Ảnh hoặc album theo capability được chứng nhận',
    summary: 'Đăng ảnh hoặc album lên đúng Fanpage, giữ thứ tự ảnh và xử lý bình luận sau khi xác minh bài.',
    requiredInputs: inputsForTarget(
      'Fanpage đích',
      'Chọn và xác minh đúng Page; không nhầm Page với nick cá nhân đang đăng nhập.',
      'Quét folder, kiểm tra loại file và thứ tự ảnh; số lượng phải nằm trong capability đã test.',
    ),
    steps: commonSteps,
    stopRules: commonStopRules,
  },
  {
    id: 'facebook-page-reels-comments',
    name: 'Đăng Reels Fanpage + bình luận',
    targetKind: 'Fanpage',
    mediaLabel: '01 video dọc/Reels',
    summary: 'Đăng video theo luồng Reels của Fanpage; xác minh đúng đích trước khi gửi bình luận.',
    requiredInputs: inputsForTarget(
      'Fanpage đích',
      'Chọn và xác minh đúng Page; profile đăng nhập và Page là hai định danh khác nhau.',
      'Quét folder video, kiểm tra định dạng/metadata và giới hạn Reels theo profile được chứng nhận.',
    ),
    steps: commonSteps,
    stopRules: commonStopRules,
  },
  {
    id: 'facebook-group-post-comments',
    name: 'Đăng bài nhóm Facebook + bình luận',
    targetKind: 'Nhóm Facebook',
    mediaLabel: 'Bài viết nhóm; media theo capability được chứng nhận',
    summary: 'Đăng bài vào đúng nhóm Facebook mà nick có quyền tham gia/đăng, sau đó xử lý bình luận.',
    requiredInputs: inputsForTarget(
      'Nhóm Facebook đích',
      'Chọn và xác minh đúng Group; kiểm tra quyền tham gia/đăng và trạng thái phê duyệt của nhóm.',
      'Quét folder; chỉ dùng loại media và số lượng đã được kiểm thử trên profile nhóm.',
    ),
    steps: commonSteps,
    stopRules: commonStopRules,
  },
];
