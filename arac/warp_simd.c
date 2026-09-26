// Derleme (src/omr/hizli-duzelt.js içindeki WASM dizisi bu dosyadan üretilir):
//   clang --target=wasm32 -O3 -msimd128 -ffp-contract=off -fno-fast-math -mnontrapping-fptoint -nostdlib \
//     -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -Wl,--export=warp -o warp_simd.wasm warp_simd.c
//   base64 -w0 warp_simd.wasm
// Doğrulama: okuyucu her açılışta sonucu OpenCV ile karşılaştırır; ayrıca arac/js_test.mjs tüm kâğıtları okur.
// OpenCV 5.0 warpPerspectiveLinearInvoker_8UC1 (skaler yol) ile bit düzeyinde aynı sonuç veren SIMD sürümü.
// Her şerit (lane) skaler koddaki float32 işlemlerin aynısını aynı sırayla yapar (IEEE: şerit başına birebir aynı).
#include <wasm_simd128.h>
typedef unsigned char u8;

static inline void piksel(const u8 *src, int srccols, int srcrows, int srcstep, u8 *dstptr, int x, int y,
                          const float *M, int bval) {
    float w = x * M[6] + y * M[7] + M[8];
    float sx = (x * M[0] + y * M[1] + M[2]) / w;
    float sy = (x * M[3] + y * M[4] + M[5]) / w;
    int ix = (int)__builtin_floorf(sx), iy = (int)__builtin_floorf(sy);
    sx -= ix; sy -= iy;
    int p00, p01, p10, p11;
    const u8 *srcptr = src + srcstep * iy + ix;
    if ((((unsigned)ix < (unsigned)(srccols - 1)) & ((unsigned)iy < (unsigned)(srcrows - 1))) != 0) {
        p00 = srcptr[0]; p01 = srcptr[1]; p10 = srcptr[srcstep]; p11 = srcptr[srcstep + 1];
    } else {
        if ((((unsigned)(ix + 1) >= (unsigned)(srccols + 1)) | ((unsigned)(iy + 1) >= (unsigned)(srcrows + 1))) != 0) {
            dstptr[x] = (u8)bval;
            return;
        }
        p00 = (((unsigned)ix < (unsigned)srccols) & ((unsigned)iy < (unsigned)srcrows)) ? srcptr[0] : bval;
        p01 = (((unsigned)(ix + 1) < (unsigned)srccols) & ((unsigned)iy < (unsigned)srcrows)) ? srcptr[1] : bval;
        p10 = (((unsigned)ix < (unsigned)srccols) & ((unsigned)(iy + 1) < (unsigned)srcrows)) ? srcptr[srcstep] : bval;
        p11 = (((unsigned)(ix + 1) < (unsigned)srccols) & ((unsigned)(iy + 1) < (unsigned)srcrows)) ? srcptr[srcstep + 1] : bval;
    }
    float v0 = p00 + sx * (p01 - p00);
    float v1 = p10 + sx * (p11 - p10);
    v0 += sy * (v1 - v0);
    int iv = (int)__builtin_rintf(v0);
    dstptr[x] = (u8)(iv < 0 ? 0 : iv > 255 ? 255 : iv);
}

__attribute__((export_name("warp")))
void warp(const u8 *src, int srccols, int srcrows, int srcstep,
          u8 *dst, int dstcols, int dstrows, const double *dM, int bval)
{
    float M[9];
    for (int i = 0; i < 9; i++) M[i] = (float)dM[i];
    const v128_t m0 = wasm_f32x4_splat(M[0]), m3 = wasm_f32x4_splat(M[3]), m6 = wasm_f32x4_splat(M[6]);
    const v128_t m2 = wasm_f32x4_splat(M[2]), m5 = wasm_f32x4_splat(M[5]), m8 = wasm_f32x4_splat(M[8]);
    const v128_t sinirX = wasm_i32x4_splat(srccols - 1), sinirY = wasm_i32x4_splat(srcrows - 1);
    const v128_t sifir = wasm_i32x4_splat(0), maks = wasm_i32x4_splat(255);
    const v128_t adim = wasm_i32x4_splat(srcstep);
    for (int y = 0; y < dstrows; y++) {
        u8 *dstptr = dst + y * dstcols;
        const float fy = (float)y;
        const v128_t ym1 = wasm_f32x4_splat(fy * M[1]), ym4 = wasm_f32x4_splat(fy * M[4]), ym7 = wasm_f32x4_splat(fy * M[7]);
        int x = 0;
        for (; x <= dstcols - 4; x += 4) {
            const v128_t fx = wasm_f32x4_convert_i32x4(wasm_i32x4_make(x, x + 1, x + 2, x + 3));
            // w = x*M6 + y*M7 + M8 ; sx = (x*M0 + y*M1 + M2) / w ; sy = (x*M3 + y*M4 + M5) / w
            const v128_t w = wasm_f32x4_add(wasm_f32x4_add(wasm_f32x4_mul(fx, m6), ym7), m8);
            v128_t sx = wasm_f32x4_div(wasm_f32x4_add(wasm_f32x4_add(wasm_f32x4_mul(fx, m0), ym1), m2), w);
            v128_t sy = wasm_f32x4_div(wasm_f32x4_add(wasm_f32x4_add(wasm_f32x4_mul(fx, m3), ym4), m5), w);
            const v128_t fsx = wasm_f32x4_floor(sx), fsy = wasm_f32x4_floor(sy);
            const v128_t ix = wasm_i32x4_trunc_sat_f32x4(fsx), iy = wasm_i32x4_trunc_sat_f32x4(fsy);
            // tüm şeritler kaynağın iç kısmında mı? (0 <= ix < cols-1, 0 <= iy < rows-1) ve sayı mı (NaN değil)
            const v128_t icX = wasm_v128_and(wasm_i32x4_ge(ix, sifir), wasm_i32x4_lt(ix, sinirX));
            const v128_t icY = wasm_v128_and(wasm_i32x4_ge(iy, sifir), wasm_i32x4_lt(iy, sinirY));
            const v128_t sayi = wasm_v128_and(wasm_f32x4_eq(sx, sx), wasm_f32x4_eq(sy, sy));
            if (!wasm_i32x4_all_true(wasm_v128_and(wasm_v128_and(icX, icY), sayi))) {
                for (int k = 0; k < 4; k++) piksel(src, srccols, srcrows, srcstep, dstptr, x + k, y, M, bval);
                continue;
            }
            // sx -= ix ; sy -= iy   (ix = (float)(int)floor(sx)  ->  floor(sx) ile aynı değer)
            sx = wasm_f32x4_sub(sx, wasm_f32x4_convert_i32x4(ix));
            sy = wasm_f32x4_sub(sy, wasm_f32x4_convert_i32x4(iy));
            const v128_t ofs = wasm_i32x4_add(wasm_i32x4_mul(iy, adim), ix);
            const int o0 = wasm_i32x4_extract_lane(ofs, 0), o1 = wasm_i32x4_extract_lane(ofs, 1);
            const int o2 = wasm_i32x4_extract_lane(ofs, 2), o3 = wasm_i32x4_extract_lane(ofs, 3);
            const v128_t p00 = wasm_i32x4_make(src[o0], src[o1], src[o2], src[o3]);
            const v128_t p01 = wasm_i32x4_make(src[o0 + 1], src[o1 + 1], src[o2 + 1], src[o3 + 1]);
            const v128_t p10 = wasm_i32x4_make(src[o0 + srcstep], src[o1 + srcstep], src[o2 + srcstep], src[o3 + srcstep]);
            const v128_t p11 = wasm_i32x4_make(src[o0 + srcstep + 1], src[o1 + srcstep + 1], src[o2 + srcstep + 1], src[o3 + srcstep + 1]);
            // v0 = p00 + sx*(p01-p00) ; v1 = p10 + sx*(p11-p10) ; v0 += sy*(v1-v0)
            v128_t v0 = wasm_f32x4_add(wasm_f32x4_convert_i32x4(p00), wasm_f32x4_mul(sx, wasm_f32x4_convert_i32x4(wasm_i32x4_sub(p01, p00))));
            const v128_t v1 = wasm_f32x4_add(wasm_f32x4_convert_i32x4(p10), wasm_f32x4_mul(sx, wasm_f32x4_convert_i32x4(wasm_i32x4_sub(p11, p10))));
            v0 = wasm_f32x4_add(v0, wasm_f32x4_mul(sy, wasm_f32x4_sub(v1, v0)));
            v128_t iv = wasm_i32x4_trunc_sat_f32x4(wasm_f32x4_nearest(v0));
            iv = wasm_i32x4_min(wasm_i32x4_max(iv, sifir), maks);
            dstptr[x] = (u8)wasm_i32x4_extract_lane(iv, 0);
            dstptr[x + 1] = (u8)wasm_i32x4_extract_lane(iv, 1);
            dstptr[x + 2] = (u8)wasm_i32x4_extract_lane(iv, 2);
            dstptr[x + 3] = (u8)wasm_i32x4_extract_lane(iv, 3);
        }
        for (; x < dstcols; x++) piksel(src, srccols, srcrows, srcstep, dstptr, x, y, M, bval);
    }
}
