#pragma once

#include "audio_ring_buffer.h"

#include <atomic>
#include <functional>
#include <string>
#include <thread>

class WasapiCapture {
public:
    using FramesCallback = std::function<void(const float*, uint32_t)>;

    WasapiCapture() = default;
    ~WasapiCapture();
    bool start(const std::wstring& endpoint_id, FramesCallback callback, std::wstring& error);
    void stop();

private:
    void run(std::wstring endpoint_id, FramesCallback callback);
    std::thread thread_;
    std::atomic<bool> stopping_{false};
    std::atomic<bool> started_{false};
    std::wstring startup_error_;
};

class WasapiRender {
public:
    using FillCallback = std::function<void(float*, uint32_t)>;

    WasapiRender() = default;
    ~WasapiRender();
    bool start(const std::wstring& endpoint_id, FillCallback callback, std::wstring& error);
    void stop();

private:
    void run(std::wstring endpoint_id, FillCallback callback);
    std::thread thread_;
    std::atomic<bool> stopping_{false};
    std::atomic<bool> started_{false};
    std::wstring startup_error_;
};

class AudioEngine {
public:
    AudioEngine();
    bool start(const std::wstring& input_id, const std::wstring& output_id, std::wstring& error);
    void stop();

private:
    void accept_microphone(const float* samples, uint32_t frames);
    void render_mix(float* destination, uint32_t frames);
    void render_monitor(float* destination, uint32_t frames);

    StereoRingBuffer microphone_{48000u * 2u};
    StereoRingBuffer monitor_{48000u};
    WasapiCapture capture_;
    WasapiRender render_;
    WasapiRender monitor_render_;
    std::atomic<float> microphone_peak_{0.0f};
    std::atomic<uint32_t> underruns_{0};
    std::atomic<bool> monitor_active_{false};
};

