-- 1) Cột ảnh đại diện cho bảng profiles (trước đây chưa có cột này)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2) Bucket chứa ảnh đại diện (public để app hiển thị được bằng URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
CREATE POLICY "avatars_auth_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;
CREATE POLICY "avatars_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');

-- 3) Bucket chứa video bài tập (public; dùng cho mục 5 bên dưới)
INSERT INTO storage.buckets (id, name, public)
VALUES ('workout-videos', 'workout-videos', true)
ON CONFLICT (id) DO NOTHING;

-- 4) Ảnh bìa thật cho tất cả bài viết / bài tập (ảnh Unsplash theo chủ đề).
-- Chỉ cập nhật các bài có đúng tiêu đề như bản seed; bài nào nhóm đổi tên
-- thì sửa lại tiêu đề trong lệnh tương ứng.
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80' WHERE title = 'Đi bộ 30 phút mỗi ngày có đủ không?';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1559825481-12a05cc00344?auto=format&fit=crop&w=800&q=80' WHERE title = 'Uống nước đúng cách trong ngày';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80' WHERE title = 'Ngủ đủ giấc giúp phục hồi như thế nào?';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80' WHERE title = 'Ăn sáng đủ chất mà không quá nhiều calo';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80' WHERE title = 'Ngồi lâu: đứng dậy vận động mỗi giờ';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80' WHERE title = 'Bài tập giãn cơ 10 phút buổi sáng';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80' WHERE title = 'Đi bộ nhanh 20 phút cho người mới bắt đầu';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80' WHERE title = 'Yoga nhẹ nhàng trước khi ngủ';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1588286840104-8957b019727f?auto=format&fit=crop&w=800&q=80' WHERE title = '15 phút Yoga & Giãn cơ cột sống buổi sáng';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80' WHERE title = 'HIIT Đốt mỡ toàn thân';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80' WHERE title = 'Siêu thực phẩm giúp tăng cường hệ miễn dịch';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80' WHERE title = 'Kỹ thuật điều hòa nhịp thở tối ưu sau khi chạy';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80' WHERE title = 'Hiểu chu kỳ kinh nguyệt: 4 pha và cách cơ thể thay đổi';
UPDATE public.posts SET cover_url = 'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?auto=format&fit=crop&w=800&q=80' WHERE title = 'Đau bụng kinh và mệt mỏi trong kỳ: làm gì để dễ chịu hơn';

