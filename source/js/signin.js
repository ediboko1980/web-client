var signinURL = "https://crypt.ee/api/auth";
var latest = (new Date()).getTime();
var photoJSON = "https://static.crypt.ee/signin-photo.json?cachebust=" + latest;
var photoURL = "https://static.crypt.ee/signin-photo.jpg?cachebust=" + latest;
var requestsURL = 'https://crypt.ee/api/';
var logintype = "";

$(".tabs").on('click', 'li', function(event) {
  whichTab = $(this).attr("tab");
  $(".tab-content").hide();
  $("#" + whichTab + "-tab-contents, #button-section, #encryption-key").show();
  $(".tabs li").removeClass('is-active');
  $(this).addClass('is-active');
  checkSigninButton ();
  // ping("click", {btn : whichTab});
});

$(window).on("load", function(event) {
  if (inIframe()){
    $(".hero-banner").removeClass("is-8");
    $(".column.is-4").remove();
    $(".title.is-1").html("WARNING");
    $(".title.is-3").html("This page is loaded in an iframe.<br>You are not on crypt.ee!");
  }

  if ($(window).width() > 768) {
    $.ajax({url: photoJSON}).done(function(data) {
      var usObj = JSON.parse(data);

      $('<img/>').attr('src', photoURL).on('load', function() {
        $(this).remove();
        $(".hero-banner .hero").css("background-image", "url("+photoURL+")");
        $('#photo-credit').html("&copy; &nbsp;" + usObj.author + " via Unsplash");
        $('#photo-credit').attr("href", usObj.author_url);
      });
    });
  }

  if (isInWebAppiOS) {
    if (!isIOSPWAAdvanced) {
      var googleAuthUUID = localStorage.getItem('gauthUUID');
      if (googleAuthUUID !== null) {
        tryGettingIdTokenFromCrypteeGAuth(googleAuthUUID);
      } else {
        console.log("generating UUID for PWA Google Login");
        generateNewUUIDForGoogleAuthOniOSPWA ();
      }
    }
  }

  try {
    sessionStorage.setItem("sessionStorageTest", "test");
    sessionStorage.removeItem("sessionStorageTest");
  } catch (e) {
    // SHOW MODAL ABOUT SESSION STORAGE ACCESS.
    $("#signin-info").html("<i class='fa fa-exclamation-triangle'></i><br><br>It seems like your browser is blocking accesss to sessionStorage.<br><br> Cryptee needs access to sessionStorage to keep you in memory while you're logged in. This error usually happens because some browsers like Firefox is a bit heavy-handed, and if you have cookies disabled, it disables sessionStorage too. Without this Cryptee will not work. We're very sorry for the inconvenience. Please enable access to sessionStorage for Cryptee and reload this page.").removeClass("is-info").addClass("is-danger").show();
    $(".login-form").hide();
    $(".tabs").hide();
    $(".forgot-password").hide();
    $("#other-error").hide();
  }

});

authenticate(function(user) {
  //got user
  
  $("html, body").removeClass("is-loading");

  checkForExistingUser();
  
}, function(){
  if (getUrlParameter("dlddid")) {
    $("#signin-info").html("Please sign in to start your download.").show();
  }
});

function checkForExistingUser (){
  if (theUserID) {
    //  CHECK IF USER HAS KEY IN DATABASE. IF NOT REDIRECT TO SIGNUP.
    getKeycheck().then(function(kcheck) {
      
      if (isMobile) {
        signInComplete();
      } else {
        $(".hero-banner").css("width", "100%");
        $(".hero-body > .container").delay(1000).fadeOut(250, function() {
          if (getUrlParameter("dlddid")) { $("#key-status").html("Enter your encryption key to start the download"); }
          showKeyModal();
        });
      }
      
    }).catch(function(error){
      if (error) {
        handleError("Can't get keycheck! Network Request Failed", error);
        $("#signin-info").html("<i class='fa fa-exclamation-triangle'></i><br><br>Looks like we can't reach one of our servers, or your browser is blocking accesss to it.<br><br>This usually happens when content/ad-blocking browser extensions or DNS/VPN filters like Pi-Hole are accidentally blocking one of Cryptee's servers. Please try again after disabling your blockers/filters, or <a href='https://crypt.ee/help'>reach out to our support</a> to get further help.").removeClass("is-info").addClass("is-danger").show();
      }
    });
  } else {
    window.location = "signup?status=newuser";
  }
}

function checkKey(key){
  $("#key-modal-decrypt-button").addClass("is-loading");
  // keycheck is set in auth.js in getKeyckeck();
  var encryptedStrongKey = JSON.parse(keycheck).data; // or encrypted checkstring for legacy accounts

  hashString(key).then(function(hashedKey){
    decrypt(encryptedStrongKey, [hashedKey]).then(function (plaintext) {
      rightKey(plaintext, hashedKey);
    }).catch(function (error) {
      checkLegacyKey(dataRef, key, hashedKey, encryptedStrongKey, function (plaintext) {
        rightKey(plaintext, hashedKey);
        // if it's wrong, wrongKey() will be called in checkLegacyKey in main.js
      });
    });
  }).catch(function(e){
    wrongKey("Wide Character Error");
  });      

}

function rightKey (plaintext, hashedKey) {
  // var theStrongKey = plaintext.data;
  // var theKey = theStrongKey;
  $("#key-modal-decrypt-button").removeClass("is-loading");
  $("#key-status").removeClass("shown");
  $("#key-modal-signout-button").removeClass("shown");

  try {
    sessionStorage.setItem("key", JSON.stringify(hashedKey));
  } catch (e) {
    // SHOW MODAL ABOUT SESSION STORAGE ACCESS.
    $("#signin-info").html("<i class='fa fa-exclamation-triangle'></i><br><br>It seems like your browser is blocking accesss to sessionStorage.<br><br> Cryptee needs access to sessionStorage to keep you in memory while you're logged in. This error usually happens because some browsers like Firefox is a bit heavy-handed, and if you have cookies disabled, it disables sessionStorage too. Without this Cryptee will not work. We're very sorry for the inconvenience. Please enable access to sessionStorage for Cryptee and reload this page.").removeClass("is-info").addClass("is-danger").show();
    $(".login-form").hide();
    $(".tabs").hide();
    $(".forgot-password").hide();
    $("#other-error").hide();
  }

  newEncryptedKeycheck(hashedKey,function(newKeycheck){
    var encryptedKeycheck = newKeycheck; // here we encrypt a timestamp using the hashedKey, and save this to localstore.
    localStorage.setItem("encryptedKeycheck", encryptedKeycheck); // we will use this in docs offline mode to verify the entered encryption key is correct.
    signInComplete();
  });
}


function signInComplete () {
  if (getUrlParameter("redirect")) {
    if (getUrlParameter("dlddid")) {
      window.location = getUrlParameter("redirect") + "?dlddid=" + getUrlParameter("dlddid");
    } else {
      window.location = getUrlParameter("redirect");
    }
  } else {
    window.location = "home";
  }
}

function checkSigninButton () {

  // sign up with username & pass
  if ($("li[tab='userpass']").hasClass("is-active")) {
    logintype = "password";
    if ($("#signin-user").val().trim() !== "" && $("#signin-pass").val().trim() !== "") {
      $("#signin-button").prop('disabled', false);
    } else {
      $("#signin-button").prop('disabled', true);
    }

  }

  if ($("li[tab='google']").hasClass("is-active")) {
    logintype = "google";
    $("#signin-button").prop('disabled', false);
  }

  setTimeout(function () {
    checkSigninButton();
  }, 250);
}

$("input").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    checkSigninButton();
  },50);
});


function signin(token){
  $("#signin-button").addClass('is-loading').prop('disabled', true);

  if ($("li[tab='userpass']").hasClass("is-active")) {

    var email;
    sessionStorage.clear();
    // try { sessionStorage.setItem("sessionID", sessionID); } catch (e) {}

    if ($("#signin-user").val().indexOf("@") != -1) {
      email = $("#signin-user").val();
    } else {
      email = $("#signin-user").val() + "@users.crypt.ee";
    }
    var password = $("#signin-pass").val();
    firebase.auth().signInWithEmailAndPassword(email, password).catch(function(error) {
      var errorCode = error.code;
      if (errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-email') {
        $("#wrong-password").fadeIn(500);
      } else if (errorCode === 'auth/user-disabled'){
        $("#user-disabled").fadeIn(500);
      } else {
        $("#other-error").fadeIn(500);
      }
      $("#signin-button").removeClass('is-loading').prop('disabled', false);
    });

  }

  function usePopup() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    firebase.auth().signInWithPopup(provider).catch(function(error) {
      if (error.code === "auth/web-storage-unsupported") {
        $("#thirdpartycookie-error").fadeIn(500);
        $("#signin-button").removeClass('is-loading').prop('disabled', false);
      } else if (error.code === "auth/missing-or-invalid-nonce") {
        
      } else if (error.code === "auth/operation-not-supported-in-this-environment") {
        $("#signin-info").html("<i class='fa fa-exclamation-triangle'></i><br><br>It seems like your browser is blocking accesss to something, or you're accessing Cryptee from an insecure environment.<br><br> Usually this happens when ad / content blockers are accidentally blocking something Cryptee needs access to. Please try again after disabling your blockers, or reach out to our support to get further help.").removeClass("is-info").addClass("is-danger").show();
        $(".login-form").hide();
        $(".tabs").hide();
        $(".forgot-password").hide();
        $("#other-error").hide();
      } else {
        $("#other-error").fadeIn(500);
        $("#signin-button").removeClass('is-loading').prop('disabled', false);
      }
    });
  }

  function useRedirect() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    // firebase.auth().signInWithRedirect(provider);
    var urlToPass = location.origin + "/gauth?uuid=" + localStorage.getItem("gauthUUID");
    var gauthFrame = document.getElementById('gauthFrame');
    var iframeDoc = gauthFrame.contentDocument || gauthFrame.contentWindow.document;
    var a = iframeDoc.createElement('a');
    a.setAttribute("href", urlToPass);
    a.setAttribute("target", "_blank");
    var dispatch = iframeDoc.createEvent("HTMLEvents");
    dispatch.initEvent("click", true, true);
    a.dispatchEvent(dispatch);
  }

  if ($("li[tab='google']").hasClass("is-active")) {
    
    if (isInWebAppiOS) {
      if (isIOSPWAAdvanced) {
        usePopup(); 
      } else {
        useRedirect();
      }
    } else {
      usePopup();
    }

  }

}

function tryGettingIdTokenFromCrypteeGAuth(googleAuthUUID) {
  $("html, body").addClass("is-loading");
  $.ajax({
    url : requestsURL + 'iosgauth',
    type: 'POST',
    dataType : "json",
    data: {"uuid" : googleAuthUUID},
    error:function (xhr, ajaxOptions, thrownError){
      console.log("no google token found on server");
      $("html, body").removeClass("is-loading");
    }
  }).done(function( response ) {
    if (response.gauth) {
      // GOT GAUTH ID TOKEN, NOW GET AUTH TOKEN.
      $.ajax({ url: tokenURL, type: 'POST',
        headers: { "Authorization": "Bearer " + response.gauth },
        contentType:"application/json; charset=utf-8",
        success: function(data){
          gotAuthToken(data);
        },
        error:function (xhr, ajaxOptions, thrownError){
          console.log("no google token found on server");
          $("html, body").removeClass("is-loading");
        }
      });
    } else {
      console.log("no google token found on server");
      $("html, body").removeClass("is-loading");
      // NO TOKEN.
    }
    localStorage.removeItem("gauthUUID");
  });
}


// magic link equivalent of google auth on iOS PWA
function generateNewUUIDForGoogleAuthOniOSPWA () {
  $.ajax({
    url : requestsURL + 'iosgauth',
    type: 'POST',
    dataType : "json",
    data: {"uuid" : ""},
    error:function (xhr, ajaxOptions, thrownError){
      console.log("no google token found on server");
      $("html, body").removeClass("is-loading");
    }
  }).done(function( response ) {
    localStorage.setItem("gauthUUID", response.uuid);
    // now when the user clicks sign in with GAuth we'll open Safari with UUID in URL and generate ID token from Google Login.
  });
}





firebase.auth().getRedirectResult().then(function(result) {
  // console.log(result);
}).catch(function(error) {
  console.log(error);
  $("#other-error").fadeIn(500);
  $("#signin-button").removeClass('is-loading').prop('disabled', false);
});

function signinRequest() {
  $.ajax({ url: signinURL, type: 'POST',
      success: function(data){
        gotAuthToken(data);
      },
      error:function (xhr, ajaxOptions, thrownError){
          console.log(thrownError);
      }
  });
}

var tokenRetry = false;
function gotAuthToken(token) {
  firebase.auth().signInWithCustomToken(token).catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log("error signing in with token");

    if (!tokenRetry) {
      setTimeout(function () {
        tokenRetry = true;
        gotAuthToken(token);
      }, 2000);
    } else {
      $("#signin-info").html("Something went wrong. It seems we can't process the signin at this moment. Please try again in a minute.").removeClass("is-info").addClass("is-warning");
      $("#signin-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
      tokenRetry = false;
    }
  });
}

$("#signin-button").on('click', function(event) {
  event.preventDefault();
  // ping("click", {
  //   btn : "signIn",
  //   method : $("li.is-active").attr("tab")
  // },function(){
    signin ();
  // });
});

$("#signin-pass, #signin-si-personal-code, #signin-mi-phone-number").on('keydown', function (e) {
  setTimeout(function(){
    if (e.keyCode == 13 && !$("#signin-button").hasClass("is-loading")) {
      // ping("keydown", {
      //   btn : "signIn",
      //   method : "userpass"
      // },function(){
        signin ();
      // });
    }
  },50);
});

$("#signin-user").on('keydown', function (e) {
  setTimeout(function(){
    if (e.keyCode == 13) {
      $("#signin-pass").focus();
    }
  },50);
});
